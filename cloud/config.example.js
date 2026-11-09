// Copy only this assignment into src/config.js for the owner's staging build.
window.PLAN_CONFIG.cloud = {
  enabled: false,
  origin: 'https://YOUR-GITHUB-USER.github.io',
  authMode: 'popup',
  firebase: {
    apiKey: 'PUBLIC_WEB_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    databaseURL: 'https://YOUR_DATABASE.REGION.firebasedatabase.app',
    projectId: 'YOUR_PROJECT',
    messagingSenderId: 'PUBLIC_MESSAGING_SENDER_ID',
    appId: 'PUBLIC_WEB_APP_ID'
  },
  vapidKey: '' // Enable only after the scheduler is deployed and Android is ready to test.
};
