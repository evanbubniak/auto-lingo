const SENDER = "auto-lingo";
const GET_SKILLS = "getSkills";
const GET_STATE = "getState";
const CLEAR_LOOP = "clearLoop";
const START_LESSON = "startLesson";
const START_LOOP = "startLoop";
const ENABLE_AUTO_ADVANCE = "enableAutoAdvance";
const DISABLE_AUTO_ADVANCE = "disableAutoAdvance";
const ENABLE_AUTO_CONTINUE = "enableAutoContinue";
const DISABLE_AUTO_CONTINUE = "disableAutoContinue";

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
          href: `https://www.duolingo.com/skill/${href_stem}/${skill.urlName}/${skill.finishedLessons + 1}`
        };
      })
      const nextUrl = formattedSkills.filter(skill => skill.level === 0)[0].href        
      
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
      // currentTab = tab;
      getSkills()
      .then(response => {
        console.log(`redirecting to ${response.nextUrl}`)
        chrome.tabs.update(currentTab.id, {url: response.nextUrl});
      });
    }
  })
}


chrome.webNavigation.onCompleted.addListener(() => {
  // console.log("webNavigation fired")
  getState("shouldContinueToNext")
    .then(shouldContinueToNext => {
      if (shouldContinueToNext) {
        goToNextLesson()
      }
    })
  }, urlFilter);

function stopInterval() {
  getCurrentTab()
  .then(currentTab => {
    if (currentTab) {
      chrome.tabs.sendMessage(currentTab.id, {sender: SENDER, message: CLEAR_LOOP})
      // currentTab = tab;
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
      // currentTab = tab;
    }
  })
  .catch(rejectedReason => {
    console.log(`startInterval failed: ${rejectedReason}`)
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.sender === SENDER) {
    if (message.message === START_LESSON) {
      goToNextLesson()
    }
    if (message.message === ENABLE_AUTO_CONTINUE) {
      setState("shouldContinueToNext", true)
    }
    if (message.message === DISABLE_AUTO_CONTINUE) {
      setState("shouldContinueToNext", false);
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
  }
});