var client = new QuranClient('https://semantic-quran.azure-mobile.net/', 'okajHbuHsfhRmylXmwQgOKAsnmUyKG49'),
    tagsMRU = [],
    tagsRecentlyAdded = [],
    resultTemplate,
    tagListTemplate,
    verseTagTemplate,
    resultPane,
    router,
    mainView,
    currentSurah,
    surahList = [];

// Prevents all anchor click handling
$.mobile.linkBindingEnabled = false;

// Disabling this will prevent jQuery Mobile from handling hash changes
$.mobile.hashListeningEnabled = false;

var Workspace = Backbone.Router.extend({
    routes: {
        "": "home",
        "search/:tag": "search",
        ":surah/:start-:end": "viewPassage",
        ":surah/:start": "viewPassage",
        ":surah": "viewPassage"
    },

    home: doViewPassage.bind(this, 1),
    viewPassage: doViewPassage.bind(this),
    search: doSearch.bind(this)
});

var MainView = Backbone.View.extend({
    el: $("#mainPage"),

    events: {
        "click #menuBtn": "toggleMenu"
    },

    initialize: function () {
        this.navPanel = $('#nav-panel');
    },

    toggleMenu: function () {
        this.navPanel.panel('toggle');
    }
});

$(function () {
    resultTemplate = _.template($("#result_template").html());
    verseTagTemplate = _.template($("#verse_tag_template").html());
    tagListTemplate = _.template($("#tag_list_template").html());
    resultPane = $('.resultsPane');

    mainView = new MainView();
    router = new Workspace();
    Backbone.history.start();

    $(window).scroll(function () {
        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            scrollMore();
        }
    });

    $('#addTagForm').submit(function () {
        $('#addTagDialogButton').click();
        return false;
    });

    var loginBtn = $("#login");
    loginBtn.click(function () {
        client.login('facebook').done(function (results) {
            loginBtn.hide();
        }, function (err) {
            alert("Error: " + err);
        });
    });

    var $body = $("body");
    $body.on("click", ".tag", function () {
        var $this = $(this);

        if (!$this.hasClass("addTag") && !$this.hasClass("recentTag")) {
            var val = $(".tagName", $this).text();
            onSearch(val);
        }
    });

    $body.on("click", "span.delete", function () {
        var $this = $(this);
        var data = $this.data();
        var parent = $this.parent().remove();
        doDeleteTag(data.tag, data.surah, data.verse);

        return false;
    });

    $("#addTagDialogButton").click(function () {
        var data = $('#addTagForm').data();
        var $textBox = $("#addTagDialogTextBox");
        var tags = $textBox.val();
        var surahNum = data.surah;
        var verseNum = data.verse;

        $textBox.val('');

        if (tags != null && tags.length > 0) {
            var values = tags.split(/[,;]/);
            $.each(values, function (i, value) {
                doAddTag(value, surahNum, verseNum).done(function (req) {
                    var val = req.result;
                    console.log("Successfully Added: " + val.text);

                    // Update the local row
                    var tagGroup = $('#tags' + surahNum + '_' + verseNum);
                    var newTag = verseTagTemplate({
                        tag: val.text,
                        surah: surahNum,
                        verse: verseNum
                    });
                    tagGroup.prepend(newTag);
                });
            });
        }

        $("#addTagPanel").panel("close");
        return false;
    });

    $body.on("click", ".addTag", function (event) {
        var data = $(this).data();

        var form = $('#addTagForm');
        form.data('surah', data.surah);
        form.data('verse', data.verse);

        var textBox = $("#addTagDialogTextBox").val("");

        $("#addTagPanel").panel('open');
        setTimeout(function () {
            textBox.focus();
        }, 500);
    });

    $("#recentlyAddedTags").on("click", ".recentTag", function () {
        var $this = $(this);
        var $textBox = $("#addTagDialogTextBox");
        var val = $(".tagName", $this).text();
        var existing = $textBox.val();
        if (existing) {
            val = existing + ',' + val;
        }
        $textBox.val(val);
    });

    $("#searchButton").click(function () {
        var val = $("#search-tag").val();

        if (val && val.length > 0) {
            onSearch(val);
        }
    });

    if (typeof (Storage) !== "undefined") {
        if (localStorage.tagsMRU) {
            tagsMRU = JSON.parse(localStorage.tagsMRU);
            updateMRU();
        }
        if (localStorage.tagsRecentlyAdded) {
            tagsRecentlyAdded = JSON.parse(localStorage.tagsRecentlyAdded);
            updateRecentlyAddedTags();
        }
    }

    var surahSelector = $("#surahSelect");
    surahListTemplate = _.template($('#surah_list_template').html());
    surahSelector.click(onSurahChanged);
    client.listSurahs()
            .done(function (req) {
                surahList = req.result || [];
                surahSelector.html(surahListTemplate({ surahs: surahList }));                
            });
});

client.onLoading = function (loading) {
    $.mobile.loading(loading ? 'show' : 'hide');
};

function doAddTag(val, surahNum, verseNum) {
    console.log("Adding tag: " + val + " to " + "[" + surahNum + ":" + verseNum + "]");

    // Add the tag to our recently added tags
    var isInList = false;
    $.each(tagsRecentlyAdded, function (i, entry) {
        if (entry === val) {
            isInList = true;
            return false;
        }
    });

    if (!isInList) {
        tagsRecentlyAdded.unshift(val);
        tagsRecentlyAdded = tagsRecentlyAdded.slice(0, 10);
        updateRecentlyAddedTags();
    }

    return client.addTag(surahNum, verseNum, val);
}

function doDeleteTag(val, surahNum, verseNum) {
    console.log("Deleting tag: " + val + " to " + "[" + surahNum + ":" + verseNum + "]");

    client.removeTag(surahNum, verseNum, val)
            .done(function () {
                console.log("Successfully Deleted")
            });
}

function updateMRU() {
    var container = $('#lastUsedTags').html(tagListTemplate({
        tags: tagsMRU,
        classes: ''
    }));

    if (typeof (Storage) !== "undefined") {
        localStorage.tagsMRU = JSON.stringify(tagsMRU);
    }
}

function updateRecentlyAddedTags() {
    var container = $('#recentlyAddedTags').html(tagListTemplate({
        tags: tagsRecentlyAdded,
        classes: 'recentTag'
    }));

    if (typeof (Storage) !== "undefined") {
        localStorage.tagsRecentlyAdded = JSON.stringify(tagsRecentlyAdded);
    }
}

function onSearch(tag) {
    router.navigate('search/' + tag, { trigger: false });
    doSearch(tag);
}

function doSearch(val) {
    currentSurah = 0;
    window.enableAutoScroll = false;

    console.log("Doing search for: " + val);
    var resultPane = $('.resultsPane').empty();

    client.findVersesByTag(val)
                .done(function (req) {
                    if (req.result && req.result.length > 0) {
                        loadResults(req.result, true);
                    }
                });

    // Add the search to our recent searches
    var isInList = false;
    $.each(tagsMRU, function (i, entry) {
        if (entry === val) {
            isInList = true;
            return false;
        }
    });

    if (!isInList) {
        tagsMRU.unshift(val);
        tagsMRU = tagsMRU.slice(0, 7);
        updateMRU();
    }
}

function doViewPassage(surah, ayahStart, ayahEnd) {
    if (surahList.length > 0 && surah >= surahList.length) {
        return;
    }

    currentSurah = surah;
    window.enableAutoScroll = true;

    var resultPane = $('.resultsPane').empty();
    loadVerses(surah, ayahStart, ayahEnd, true);

    window.ayahStart = ayahStart || 1;
    window.ayahEnd = ayahEnd || 50;
}

function scrollMore() {
    if (!window.enableAutoScroll ||
        currentSurah == 0 ||
        (surahList.length > 0 && window.ayahEnd >= surahList[currentSurah - 1].verses)) {
        return;
    }

    window.ayahStart += 50;
    window.ayahEnd = Math.min(window.ayahEnd + 50, surahList[currentSurah - 1].verses);
    loadVerses(currentSurah, window.ayahStart, window.ayahEnd, false);
}

function loadVerses(surah, start, end, animate) {
    window.loading = true;
    client.getVersesByRange(surah, start, end)
                .done(function (req) {
                    if (req.result) {
                        loadResults(req.result, animate);                        
                    }
                });
}

var lastPlayer;
function pausePreviousAudio(e) {
    var self = e.target;
    if (lastPlayer) {
        if (lastPlayer.pause) {
            lastPlayer.pause();
        }
        $(lastPlayer).css('width', '40px');
    }
    $(self).css('width', '200px');
    lastPlayer = self;
}

function loadResults(data, animate) {
    resultPane.html(resultTemplate({
        data: data,
        tagTemplate: verseTagTemplate
    }));

    if (animate) {
        window.scroll(0, 0);
    }
}

function onSurahChanged() {
    var surah = $("#surahSelect").val();
    if (currentSurah == surah) {
        return;
    }

    router.navigate(surah, { trigger: false });
    doViewPassage(surah);
}