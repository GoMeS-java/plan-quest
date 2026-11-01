// Isolated Android build. No credentials or tokens. The production OAuth ID
// is public configuration and is used only as a denylist, never for login.
window.PLAN_CONFIG = {
  testMode: true,
  cloudEnabled: false,
  clientId: '',
  allowedOrigin: '',
  productionClientId: '897233770502-j406ch8mdg8rnhf5ho5k6g84jrjgmi31.apps.googleusercontent.com',
  fileName: 'plan-data-android-test'
};
