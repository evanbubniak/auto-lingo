const PLAYER_NEXT = 'button[data-test="player-next"]';
const BLAME_INCORRECT = '[data-test="blame blame-incorrect"]';
const SENDER = "auto-lingo";
const GET_STATE = "getState";
const START_LOOP = "startLoop";
const CLEAR_LOOP = "clearLoop";
const START_LESSON = "startLesson";

const INTERVAL_LENGTH = 750;

function main() {
    const nextButtons = document.querySelectorAll(PLAYER_NEXT);
    const nextButton = nextButtons[0];
    if (nextButton) {
        const correctAnswer = document.querySelectorAll(BLAME_INCORRECT).length === 0;
        if ((nextButton.textContent.toUpperCase().valueOf() === "CONTINUE" && correctAnswer) || nextButton.textContent.toUpperCase().valueOf() === "EQUIP FOR FREE") {
            nextButton.click();
        }
        const purchaseStepActive = document.querySelectorAll('[data-test="purchase-step-active"]');
        const keepPracticingNow = nextButton.textContent.toUpperCase().valueOf() === "LEARN MORE"
        if (keepPracticingNow) {
            const bottom_bottons = document.getElementById("session/PlayerFooter").getElementsByTagName("button")
            Array.from(bottom_bottons).filter(button => button.textContent.toUpperCase() === "NO THANKS")[0].click()
        }
        if (purchaseStepActive.length > 0) {
            const noThanks = document.querySelector('[data-test="plus-no-thanks"]');
            noThanks.click();
        }
    } else {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearLoop();
        chrome.runtime.sendMessage({ sender: SENDER, message: GET_STATE, key: "shouldContinueToNext" }, (shouldContinueToNext) => {
            if (shouldContinueToNext) {
                chrome.runtime.sendMessage({ sender: SENDER, message: START_LESSON });
            }
        })
    }
}

let intervalId;
function startLoop() {
    if (!intervalId) {
        intervalId = setInterval(main, INTERVAL_LENGTH);
    }
}

function clearLoop() {
    if (intervalId && chrome.runtime?.id) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function pauseLoop() {
    if (intervalId && chrome.runtime?.id) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

window.onload = () => {
    chrome.runtime.sendMessage({ sender: SENDER, message: GET_STATE, key: "shouldAutoAdvance" }, (shouldAutoAdvance) => {
        if (shouldAutoAdvance) {
            startLoop()
        }
    })
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.sender === SENDER && message.message === CLEAR_LOOP && intervalId) {
            clearLoop();
        }
        if (message.sender === SENDER && message.message === START_LOOP && !intervalId) {
            startLoop();
        }
    })
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

handleVisibilityChange = () => {
    if (chrome.runtime?.id) {
        if (document.visibilityState === 'visible') {
            chrome.runtime.sendMessage({ sender: SENDER, message: GET_STATE, key: "shouldAutoAdvance" }, (shouldAutoAdvance) => {
                if (shouldAutoAdvance && !intervalId) {
                    startLoop();
                }
            })
        } else {
            if (intervalId) {
                pauseLoop()
            }
        }
    } else {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
}