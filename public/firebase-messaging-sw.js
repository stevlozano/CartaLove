importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDehWaTzsvpbbOWvfOpIoprkg8ew3-bkak",
  authDomain: "carta-love-susystev.firebaseapp.com",
  databaseURL: "https://carta-love-susystev-default-rtdb.firebaseio.com/",
  projectId: "carta-love-susystev",
  storageBucket: "carta-love-susystev.firebasestorage.app",
  messagingSenderId: "107910885138",
  appId: "1:107910885138:web:262b732361a87baccacdcb",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "Carta", {
    body: body || "",
    icon: icon || "/favicon.ico",
  });
});
