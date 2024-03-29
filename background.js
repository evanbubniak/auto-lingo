const SENDER = "auto-lingo-background";
const GET_SKILLS = "getSkills";
const GET_STATE = "getState";
const CLEAR_LOOP = "clearLoop";
const START_LESSON = "startLesson";
const START_PRACTICE = "startPractice";
const START_LOOP = "startLoop";
const ENABLE_AUTO_ADVANCE = "enableAutoAdvance";
const DISABLE_AUTO_ADVANCE = "disableAutoAdvance";
const AUTO_NEXT_LESSON = "next-lesson"
const AUTO_NEXT_PRACTICE = "practice"
const AUTO_NEXT_DISABLED = "none"
const PRACTICE_URL = "https://www.duolingo.com/practice"


const urlFilter = {
    url: [
      {
        urlContains: "duolingo.com/learn"
      },
    ],
  };

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  return new Promise((resolve, reject) => {
      chrome.tabs.query(queryOptions)
          .then(tabs => {
              if (tabs.length > 0) {
                resolve(tabs[0]);
              } else {
                resolve(null);
              }
              
          }, err => {
              reject(err)
          })
  });
}

async function getCookieValue(name, url) {
  return new Promise((resolve, reject) => {
    chrome.cookies.get({
      name: name,
      url: url
    }, cookie => resolve(cookie.value))
  });
}

async function getSkills() {
  let uuid;
  let jwt_token;
  return new Promise((resolve, reject) => {
    getCookieValue("logged_out_uuid", "https://www.duolingo.com/")
    .then(uuid_resp => {      
      uuid = uuid_resp;
      return getCookieValue("jwt_token", "https://www.duolingo.com/")})
    .then(jwt_token_resp => {      
      jwt_token = jwt_token_resp;
      return fetch(`https://www.duolingo.com/2017-06-30/users/${uuid}?fields=currentCourse`,
        {
          "headers": {
            "authorization": `Bearer ${jwt_token}`,
            "accept": "application/json, text/plain, */*"
          }
        });
      })
    .then(response => {
      return response.json();
    })
    .then(response_json => {      
      const skillsTree = response_json.currentCourse.skills;
      const href_stem = response_json.currentCourse.trackingProperties.learning_language;
      const flattenedSkills = skillsTree.flat()
      const formattedSkills = flattenedSkills.map(skill => {
        return {
          name: skill.name,
          level: skill.finishedLevels,
          href: `https://www.duolingo.com/skill/${href_stem}/${encodeURIComponent(skill.urlName)}/${skill.finishedLessons + 1}`,
          accessible: skill.hasOwnProperty("accessible") && skill.accessible ? true : false
        };
      })
      const nextSkill = formattedSkills.filter(skill => skill.level === 0)[0]
      let nextUrl;
      if (nextSkill.accessible) {
        nextUrl = nextSkill.href;
      } else {
        const nextCheckpoint = response_json.currentCourse.sections.filter(section => section.checkpointAccessible && !(section.checkpointFinished))[0];
        const nextCheckpointNum = (parseInt(nextCheckpoint.name.substring(11)) - 1).toString();
        nextUrl = `https://www.duolingo.com/checkpoint/${href_stem}/${nextCheckpointNum}`
      }
      
      
      resolve({
        skills: formattedSkills,
        nextUrl: nextUrl
      })})
  })
}

function setState(key, value) {
  chrome.storage.local.set({[key]: value})
}

const defaultStates = {
  shouldContinueToNext: false,
  shouldAutoAdvance: false,
  continueType: AUTO_NEXT_DISABLED
}

async function getState(key) {
  return new Promise((resolve, reject) => {
  try {
    chrome.storage.local.get([key])
      .then(result => {
        if (typeof result[key] === 'undefined') {
          value = defaultStates[key];
          setState(key, value);
        } else {
          value = result[key]; 
        }
        resolve(value);
      })
  } catch {
    reject("getting state failed")
  }
})
}

function goToNextLesson() {
  getCurrentTab()
  .then(currentTab => {
    if (currentTab) {
      getSkills()
      .then(response => {
        chrome.tabs.update(currentTab.id, {url: response.nextUrl});
      });
    }
  })
}

function goToPractice() {
  getCurrentTab()
  .then(currentTab => {
    if (currentTab) {
      chrome.tabs.update(currentTab.id, {url: PRACTICE_URL});
    }
  })
}


// chrome.webNavigation.onCompleted.addListener(() => {
//   getState("shouldContinueToNext")
//     .then(shouldContinueToNext => {
//       if (shouldContinueToNext) {
//         goToNextLesson()
//       }
//     })
//   }, urlFilter);

function handleHomepage() {
  getState("continueType")
    .then(continueType => {
      if (continueType === AUTO_NEXT_LESSON) {
        goToNextLesson()
      } else if (continueType === AUTO_NEXT_PRACTICE) {
        goToPractice()
      }
    })
}

chrome.webNavigation.onHistoryStateUpdated.addListener(handleHomepage, urlFilter);

chrome.webNavigation.onCompleted.addListener(handleHomepage, urlFilter);

function stopInterval() {
  getCurrentTab()
  .then(currentTab => {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, {sender: SENDER, message: CLEAR_LOOP})
    }
  })
  .catch(rejectedReason => {
    console.log(`stopInterval failed: ${rejectedReason}`)
  })
}

function startInterval() {
  getCurrentTab()
  .then(currentTab => {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, {sender: SENDER, message: START_LOOP})
    }
  })
  .catch(rejectedReason => {
    console.log(`startInterval failed: ${rejectedReason}`)
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.message === START_LESSON) {
    goToNextLesson()
  }

  if (message.message === START_PRACTICE) {
    goToPractice()
  }

  if (message.message ===AUTO_NEXT_LESSON) {
    setState("continueType", AUTO_NEXT_LESSON)
  }
  if (message.message ===AUTO_NEXT_PRACTICE) {
    setState("continueType", AUTO_NEXT_PRACTICE)
  }
  if (message.message ===AUTO_NEXT_DISABLED) {
    setState("continueType", AUTO_NEXT_DISABLED)
  }


  if (message.message === ENABLE_AUTO_ADVANCE) {
    setState("shouldAutoAdvance", true)
    startInterval()
  }
  if (message.message === DISABLE_AUTO_ADVANCE) {
    setState("shouldAutoAdvance", false);
    stopInterval()
  }
  if (message.message === GET_STATE) {
    getState(message.key)
      .then(value => {
        sendResponse(value);
      })
  }
  if (message.message === GET_SKILLS) {
    getSkills()
    .then(skillsResp => {
      sendResponse(skillsResp);
    })
  }
  return true;
});