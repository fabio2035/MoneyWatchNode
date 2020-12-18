//Import Admin SDK
var admin = require("firebase-admin");
const fs = require('fs');

console.log('Initializing Execution...');

const localRatesFile = 'currency_db.json';

//get all previously updated currencies
const previouslyUpdatedRates = JSON.parse(fs.readFileSync(localRatesFile).toString());
const previousRates = previouslyUpdatedRates['symbols'];

// Fetch the service account key JSON file contents
var serviceAccount = require(__dirname + "/moneywatch-4830f-firebase-adminsdk-77pu7-f2538b2afe.json");

// Initialize the app with a service account, granting admin privileges

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://moneywatch-4830f.firebaseio.com"
});

// As an admin, the app has access to read and write all data, regardless of security Rules
var db = admin.database();

var ref = db.ref("/symbols");

//upload rates to firebase
let uploadFirebase = new Promise((resolve, reject) => {

  Object.keys(previousRates).forEach(key => {
    setRate(key);
  });

  resolve('terminated execution...');
});

function setRate(key){

var symbolChild = ref.child(key);

symbolChild.set({
    date: previousRates[key].date,
    rate: previousRates[key].rate
});

}

uploadFirebase.then((result) => console.log(result));

// console.log('Terminated Execution...');

// var symbolChild = ref.child("USD_YEN");
