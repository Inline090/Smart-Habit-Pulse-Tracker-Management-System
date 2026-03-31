let currentFilter = "all";
const quotes = [
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
    { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
    { text: "No great thing is created suddenly.", author: "Epictetus" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Well done is better than well said.", author: "Benjamin Franklin" },
    { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Johann Wolfgang von Goethe" },
    { text: "Great works are performed not by strength but by perseverance.", author: "Samuel Johnson" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "If people knew how hard I worked to get my mastery, it would not seem so wonderful at all.", author: "Michelangelo" },
    { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
    { text: "Everyone thinks of changing the world, but no one thinks of changing himself.", author: "Leo Tolstoy" },
    { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
    { text: "Make the most of yourself, for that is all there is of you.", author: "Ralph Waldo Emerson" },
    { text: "No one is useless in this world who lightens the burden of another.", author: "Charles Dickens" },
    { text: "We learn wisdom from failure much more than from success.", author: "Samuel Smiles" },
    { text: "A wise man will make more opportunities than he finds.", author: "Francis Bacon" },
    { text: "The greatest thing in the world is to know how to belong to oneself.", author: "Michel de Montaigne" },
    { text: "A good reputation is more valuable than money.", author: "Publilius Syrus" },
    { text: "Go confidently in the direction of your dreams. Live the life you have imagined.", author: "Henry David Thoreau" },
    { text: "Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.", author: "Booker T. Washington" },
    { text: "The more we do, the more we can do.", author: "William Hazlitt" },
    { text: "Be content to act, and leave the talking to others.", author: "Baltasar Gracian" },
    { text: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius" },
    { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" }
];
const introStorageKey = "smart_habit_pulse_tracker_intro_seen";
const introLines = [
    "[OK] Loading interface modules...",
    "[OK] Syncing habit tracker workspace...",
    "[OK] Preparing daily progress dashboard...",
    "[OK] Restoring quote generator cache...",
    "[OK] Launch complete. Opening system."
];
const introStartDelay = 700;
const introStepDelay = 560;
const introEndDelay = 950;
const metricBarWidth = 20;
let quoteTypingAnimationId = 0;
let currentQuoteIndex = 0;
const dashboardBarState = {
    completedFilled: 0,
    pendingFilled: 0,
    introFilled: 0,
    completedAnimationId: 0,
    pendingAnimationId: 0,
    introAnimationId: 0
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderBar(value, total, width = 20) {
    if (!total) {
        return `[${".".repeat(width)}]`;
    }

    const filled = Math.max(0, Math.min(width, Math.round((value / total) * width)));
    return `[${"|".repeat(filled)}${".".repeat(width - filled)}]`;
}

function padCount(value) {
    return String(value).padStart(2, "0");
}

function updateTerminalCaret() {
    const input = document.getElementById("habitInput");
    const mirror = document.getElementById("inputMirror");
    const caret = document.getElementById("terminalCaret");

    if (!input || !mirror || !caret) {
        return;
    }

    const caretIndex = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const contentBeforeCaret = input.value.slice(0, caretIndex).replace(/ /g, "\u00a0");

    mirror.textContent = contentBeforeCaret;

    const mirrorWidth = mirror.getBoundingClientRect().width;
    const inputWidth = input.getBoundingClientRect().width;
    const caretWidth = caret.getBoundingClientRect().width || 10;
    const nextLeft = Math.min(Math.max(0, mirrorWidth - input.scrollLeft), Math.max(0, inputWidth - caretWidth));

    caret.style.left = `${nextLeft}px`;
}

function easeOutCubic(progress) {
    return 1 - Math.pow(1 - progress, 3);
}

function animateBarFill(selector, fromFilled, toFilled, toneClass, animationKey) {
    const element = $(selector);
    const duration = 680;
    const start = window.performance.now();
    dashboardBarState[animationKey] += 1;
    const animationId = dashboardBarState[animationKey];

    function tick(now) {
        if (dashboardBarState[animationKey] !== animationId) {
            return;
        }

        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentFilled = Math.round(fromFilled + (toFilled - fromFilled) * easedProgress);

        element
            .toggleClass("is-animating", progress < 1)
            .toggleClass("is-amber", toneClass === "amber")
            .text(`[${"|".repeat(currentFilled)}${".".repeat(metricBarWidth - currentFilled)}]`);

        if (progress < 1) {
            window.requestAnimationFrame(tick);
        } else {
            element.removeClass("is-animating");
        }
    }

    window.requestAnimationFrame(tick);
}

function animateDashboardBars(completed, pending, total) {
    const nextCompletedFilled = total ? Math.round((completed / total) * metricBarWidth) : 0;
    const nextPendingFilled = total ? Math.round((pending / total) * metricBarWidth) : 0;

    animateBarFill(
        "#completedBar",
        dashboardBarState.completedFilled,
        nextCompletedFilled,
        "green",
        "completedAnimationId"
    );
    animateBarFill(
        "#pendingBar",
        dashboardBarState.pendingFilled,
        nextPendingFilled,
        "amber",
        "pendingAnimationId"
    );

    dashboardBarState.completedFilled = nextCompletedFilled;
    dashboardBarState.pendingFilled = nextPendingFilled;
}

function showMessage(tone, text) {
    const prefixMap = {
        success: "[OK]",
        warning: "[WARN]",
        error: "[ERR]",
        info: "[SYS]"
    };

    $("#messageBox")
        .attr("data-tone", tone)
        .html(`
            <span class="message-prefix">${prefixMap[tone] || "[SYS]"}</span>
            <span class="message-text">${escapeHtml(text)}</span>
        `);
}

function typeQuoteText(fullText) {
    const quoteText = document.getElementById("quoteText");
    const quoteTextValue = document.getElementById("quoteTextValue");
    const quoteAuthor = document.getElementById("quoteAuthor");

    if (!quoteText || !quoteTextValue || !quoteAuthor) {
        return;
    }

    quoteTypingAnimationId += 1;
    const animationId = quoteTypingAnimationId;
    const characters = Array.from(fullText);
    const duration = Math.max(1300, Math.min(3200, characters.length * 42));
    const start = window.performance.now();

    quoteText.classList.add("is-typing");
    quoteAuthor.classList.add("is-hidden");
    quoteTextValue.textContent = "";

    function tick(now) {
        if (animationId !== quoteTypingAnimationId) {
            return;
        }

        const progress = Math.min((now - start) / duration, 1);
        const visibleCount = Math.max(1, Math.floor(progress * characters.length));
        quoteTextValue.textContent = characters.slice(0, visibleCount).join("");

        if (progress < 1) {
            window.requestAnimationFrame(tick);
        } else {
            quoteTextValue.textContent = fullText;
            quoteText.classList.remove("is-typing");
            window.setTimeout(function () {
                if (animationId === quoteTypingAnimationId) {
                    quoteAuthor.classList.remove("is-hidden");
                }
            }, 40);
        }
    }

    window.requestAnimationFrame(tick);
}

function renderQuote(quote) {
    typeQuoteText(`"${quote.text}"`);
    $("#quoteAuthor").text(`- ${quote.author}`);
}

function showNextQuote(initialLoad = false) {
    if (!initialLoad) {
        currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    }

    renderQuote(quotes[currentQuoteIndex]);
}

function renderIntroProgress(step, total) {
    const nextIntroFilled = total ? Math.round((step / total) * metricBarWidth) : 0;

    animateBarFill(
        "#introProgress",
        dashboardBarState.introFilled,
        nextIntroFilled,
        "amber",
        "introAnimationId"
    );

    dashboardBarState.introFilled = nextIntroFilled;
}

function appendIntroLine(text) {
    $("#introLog").append(`<p class="intro-line"><strong>$</strong> ${escapeHtml(text)}</p>`);
}

function finishIntro() {
    $("body").removeClass("intro-active");
    document.documentElement.classList.remove("intro-pending");

    window.setTimeout(function () {
        $("#introScreen").attr("aria-hidden", "true");
    }, 350);
}

function startIntroSequence() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let hasSeenIntro = false;

    try {
        hasSeenIntro = window.localStorage.getItem(introStorageKey) === "true";
    } catch (error) {
        hasSeenIntro = false;
    }

    if (reduceMotion || hasSeenIntro) {
        finishIntro();
        return;
    }

    $("body").addClass("intro-active");
    $("#introScreen").attr("aria-hidden", "false");
    $("#introLog").empty();
    renderIntroProgress(0, introLines.length);

    const timers = [];

    introLines.forEach(function (line, index) {
        const timer = window.setTimeout(function () {
            appendIntroLine(line);
            renderIntroProgress(index + 1, introLines.length);
        }, introStartDelay + index * introStepDelay);

        timers.push(timer);
    });

    const completeTimer = window.setTimeout(function () {
        try {
            window.localStorage.setItem(introStorageKey, "true");
        } catch (error) {
        }

        finishIntro();
    }, introStartDelay + introLines.length * introStepDelay + introEndDelay);

    timers.push(completeTimer);

    $("#skipIntroBtn").off("click").on("click", function () {
        timers.forEach(function (timer) {
            window.clearTimeout(timer);
        });

        try {
            window.localStorage.setItem(introStorageKey, "true");
        } catch (error) {
        }

        finishIntro();
    });
}

function updateFilterState() {
    $(".filterBtn").each(function () {
        const isActive = $(this).data("filter") === currentFilter;
        $(this).toggleClass("active", isActive);
        $(this).attr("aria-pressed", String(isActive));
    });

    $("#activeFilter").text(`[ FILTER ${currentFilter.toUpperCase()} ]`);
}

function updateSyncClock() {
    const now = new Date();
    const timeStamp = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    $("#lastSync").text(`[ SYNC ${timeStamp} ]`);
}

function loadDashboard() {
    $.get("/api/dashboard/", function (data) {
        const total = data.total || 0;
        const completed = data.completed || 0;
        const pending = data.pending || 0;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;

        $("#totalCount").text(padCount(total));
        $("#completedCount").text(padCount(completed));
        $("#pendingCount").text(padCount(pending));
        animateDashboardBars(completed, pending, total);
        $("#completionRate").text(`${String(completionRate).padStart(2, "0")}%`);

        let statusText = "[ IDLE ]";
        if (total > 0) {
            statusText = completionRate === 100 ? "[ OPTIMAL ]" : "[ TRACKING ]";
        }

        $("#systemStatus").text(statusText);
        $("#completionSummary").text(
            total === 0
                ? "No habits tracked yet."
                : `${completed} completed and ${pending} pending out of ${total} habits.`
        );
        updateSyncClock();
    }).fail(function () {
        showMessage("error", "Unable to load dashboard status.");
    });
}

function buildHabitRow(habit) {
    const checked = habit.completed ? "checked" : "";
    const statusClass = habit.completed ? "is-done" : "is-pending";
    const statusLabel = habit.completed ? "[DONE]" : "[TODO]";

    return `
        <article class="habit-row ${habit.completed ? "is-complete" : ""}" role="listitem">
            <div class="habit-main">
                <label class="habit-toggle" for="habit-${habit.id}">
                    <input
                        type="checkbox"
                        id="habit-${habit.id}"
                        class="completeCheckbox"
                        data-id="${habit.id}"
                        ${checked}
                        aria-label="Toggle habit completion"
                    >
                    <span class="checkbox-ui" aria-hidden="true">${habit.completed ? "[x]" : "[ ]"}</span>
                    <span class="habit-status ${statusClass}">${statusLabel}</span>
                    <span class="habit-name">${escapeHtml(habit.name)}</span>
                </label>
                <p class="habit-meta">-- created ${escapeHtml(habit.created_at)}</p>
            </div>
            <button class="terminal-button danger deleteBtn" type="button" data-id="${habit.id}">
                [ PURGE ]
            </button>
        </article>
    `;
}

function loadHabits() {
    $.get("/api/habits/", function (data) {
        $("#habitList").empty();
        let visibleCount = 0;

        data.forEach(function (habit) {
            if (currentFilter === "completed" && !habit.completed) {
                return;
            }

            if (currentFilter === "pending" && habit.completed) {
                return;
            }

            visibleCount += 1;
            $("#habitList").append(buildHabitRow(habit));
        });

        $("#listMeta").text(`[ ${padCount(visibleCount)} ITEMS ]`);

        if (visibleCount === 0) {
            $("#habitList").html(`
                <div class="empty-state">
                    <strong>[ EMPTY LOG ]</strong><br>
                    No habits match the current filter. Add a new routine or switch views.
                </div>
            `);
        }
    }).fail(function () {
        showMessage("error", "Unable to load the habit log.");
    });
}

function submitHabit() {
    const habitName = $("#habitInput").val().trim();

    if (!habitName) {
        showMessage("warning", "Enter a habit before running the command.");
        return;
    }

    $.ajax({
        url: "/add/",
        type: "POST",
        data: JSON.stringify({ name: habitName }),
        contentType: "application/json",
        success: function (response) {
            if (response.status === "success") {
                $("#habitInput").val("");
                updateTerminalCaret();
                showMessage("success", "Habit added.");
                loadHabits();
                loadDashboard();
                return;
            }

            showMessage("warning", response.error || "Unable to add habit.");
        },
        error: function () {
            showMessage("error", "The add command failed.");
        }
    });
}

$(document).ready(function () {
    startIntroSequence();
    updateFilterState();
    showNextQuote(true);
    loadHabits();
    loadDashboard();
    updateTerminalCaret();

    $("#addBtn").on("click", submitHabit);
    $("#newQuoteBtn").on("click", function () {
        showNextQuote();
    });

    $("#habitInput").on("keydown", function (event) {
        if (event.key === "Enter") {
            submitHabit();
        }

        window.requestAnimationFrame(updateTerminalCaret);
    });

    $("#habitInput").on("input click focus blur keyup select", function () {
        window.requestAnimationFrame(updateTerminalCaret);
    });

    $(window).on("resize", updateTerminalCaret);

    $(".filterBtn").on("click", function () {
        currentFilter = $(this).data("filter");
        updateFilterState();
        loadHabits();
        showMessage("info", `Filter switched to ${currentFilter}.`);
    });

    $(document).on("change", ".completeCheckbox", function () {
        const id = $(this).data("id");
        const completed = $(this).is(":checked");

        $.ajax({
            url: `/api/habits/${id}/`,
            type: "PUT",
            data: JSON.stringify({ completed: completed }),
            contentType: "application/json",
            success: function () {
                showMessage("success", completed ? "Habit marked complete." : "Habit marked pending.");
                loadHabits();
                loadDashboard();
            },
            error: function () {
                showMessage("error", "Unable to update habit status.");
            }
        });
    });

    $(document).on("click", ".deleteBtn", function () {
        const id = $(this).data("id");

        $.ajax({
            url: `/api/habits/${id}/`,
            type: "DELETE",
            success: function () {
                showMessage("warning", "Habit removed.");
                loadHabits();
                loadDashboard();
            },
            error: function () {
                showMessage("error", "Unable to purge habit.");
            }
        });
    });
});
