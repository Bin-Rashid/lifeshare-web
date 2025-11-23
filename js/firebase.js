// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC12Yy3vkdtfCWh-O2iHGBbTQVsMcF7qRI",
    authDomain: "lifeshare-donors.firebaseapp.com",
    databaseURL: "https://lifeshare-donors-default-rtdb.firebaseio.com",
    projectId: "lifeshare-donors",
    storageBucket: "lifeshare-donors.firebasestorage.app",
    messagingSenderId: "976631182826",
    appId: "1:976631182826:web:eb3287835b816e19c7ae93"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Firebase References
const donorsRef = database.ref('donors');
const positionsRef = database.ref('positions');
