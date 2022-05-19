const SENDER = "auto-lingo-extension-menu"
const GET_SKILLS = "getSkills";
const GET_STATE = "getState";
const START_LESSON = "startLesson";
const ENABLE_AUTO_ADVANCE = "enableAutoAdvance";
const DISABLE_AUTO_ADVANCE = "disableAutoAdvance";
const ENABLE_AUTO_CONTINUE = "enableAutoContinue";
const DISABLE_AUTO_CONTINUE = "disableAutoContinue";

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    return new Promise((resolve, reject) => {
        chrome.tabs.query(queryOptions)
            .then(tabs => {
                resolve(tabs[0]);
            }, err => {
                reject(err)
            })
    });
  }

function add(skill, skillsList) {
    const listItem = document.createElement("li");
    const textToShow = "(" + skill.level.toString() + "): " + skill.name;
    let linkItem;
    if (skill.href) {
        linkItem = document.createElement("a");
        linkItem.setAttribute("href", skill.href)
        linkItem.appendChild(document.createTextNode(textToShow));
    } else {
        linkItem = document.createTextNode(textToShow);
    }

    listItem.appendChild(linkItem);
    skillsList.appendChild(listItem);
}

function disableClick(event) {
    event.preventDefault();
}

async function getState(key) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({sender: SENDER, message: GET_STATE, key: key}, (value) => {
            resolve(value);
        })
    })
    
}

window.onload = () => {
    const next = document.getElementById("next");
    const autoStart = document.getElementById("auto-start");
    const autoAdvance = document.getElementById("auto-advance");
    

    next.addEventListener("click", event => {
        event.preventDefault();
        chrome.runtime.sendMessage({sender: SENDER, message: START_LESSON});
    });

    getState("shouldContinueToNext")
        .then(shouldContinueToNext => {
            if (shouldContinueToNext) {
                autoStart.checked = true;
            } else {
                autoStart.checked = false;
            }
            autoStart.disabled = false;
            autoStart.addEventListener("change", event => {
                if (autoStart.checked) {
                    chrome.runtime.sendMessage({sender: SENDER, message: ENABLE_AUTO_CONTINUE})
                } else {
                    chrome.runtime.sendMessage({sender: SENDER, message: DISABLE_AUTO_CONTINUE})
                }
            })
        })

    getState("shouldAutoAdvance")
        .then(shouldAutoAdvance => {
            if (shouldAutoAdvance) {
                autoAdvance.checked = true;
            } else {
                autoAdvance.checked = false;
            }
            autoAdvance.disabled = false;
            autoAdvance.addEventListener("change", event => {
                if (autoAdvance.checked) {
                    chrome.runtime.sendMessage({sender: SENDER, message: ENABLE_AUTO_ADVANCE})
                } else {
                    chrome.runtime.sendMessage({sender: SENDER, message: DISABLE_AUTO_ADVANCE})
                }
            })
        })


    // chrome.runtime.sendMessage({sender: SENDER, message: GET_SKILLS}, (response) => {
    //     const skills = response.skills;
    //     const newSkills = skills.filter(skill => skill.level == 0 && skill.href);
    //     document.getElementById("openNext").removeEventListener("click", disableClick);
    //     document.getElementById("openNext").addEventListener("click", event => {
    //         event.preventDefault();
    //         chrome.runtime.sendMessage({sender: SENDER, message: START_LESSON});
    //     });
    //     newSkills.forEach(skill => {
    //         add(skill, skillsList);
    //     })
    // })
               
}