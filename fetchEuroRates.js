const fetch = require('node-fetch');
const winston = require('winston');
const fs = require('fs');

const symbolsFile = 'Symbols_test.txt';
const localRatesFile = 'currency_db.json';

console.log('Updating rates...');

let today = new Date();

let todayFormatted = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;

//minimum n of days that rates can stay without being updated
//all dates lower than variable will be removed from availableSymbols array
let minimumUpdateDays = 3;

// create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service'},
  transports: [
    // - write all leve logs to debu.log
    new winston.transports.File({filename: 'debug.log'}),
    new winston.transports.Console({      timestamp: true    }),
  ],
});

logger.log({
  level: 'info',
  message: `${today} - Reading local files`
});

//read all available symbols from txt file
var availableSymbols = fs.readFileSync(symbolsFile).toString().split(' ');

//get all previously updated currencies
const previouslyUpdatedRates = JSON.parse(fs.readFileSync(localRatesFile).toString());
const previousRates = previouslyUpdatedRates['symbols'];

//create format for local symbols json
var jsonMain = {};
var jsonSymbols = {};

//definition of URI to call API request
var options = {
  authority: 'https://',
  host: 'free.currconv.com',
  endpoint: '/api/v7/convert?',
  api: 'apiKey=493db447d324e52eb0dc',
  parameters: '&compact=y&q=',
  currency: 'USD_MZN'
};

//loop through all previously updated currencies
//and check which symbols are up to day so we can remove these from the
//complete list - returns list of symbols to remove
let getSymbolsToRemoveList = new Promise((resolve, reject) => {

  logger.log({
    level: 'info',
    message: `${today} - Creating Symbols to Remove list`
  });

  //array to keep symbols for API call
  var ratesToRemove = [];

  Object.keys(previousRates).forEach(key => {
    var remove = checkLastUpdate(key);
    if(remove){
      // let keys = Object.keys(previouslyUpdatedRates[key]);
      // let symbolToDelete = keys[0];
    ratesToRemove.push(key);
    }
  });

  resolve(ratesToRemove);
});

//check for up-to-date rates to remove from gerenal symbols list
// - returns true if Symbol needs to be removed
function checkLastUpdate(key){

var tmp_today = new Date(todayFormatted);
var jsonDate = new Date(previousRates[key].date);

//calculate the time difference of 2 days
var difference_in_time = tmp_today.getTime() - jsonDate.getTime();

//calculate number of days difference_in_days
var difference_in_days = difference_in_time / (1000 * 3600 * 24);

//if difference of days between json and today is within minimum,
//remove from total symbols list so we don't have to update these rates
if(difference_in_days < minimumUpdateDays){
  return true;
}else{
  return false;
}
}

//removes symbols from the availiable symbols array
let removeElementFromSymbolsArray = function(symbolsToRemove){
  return new Promise(function(resolve, reject){

    if(symbolsToRemove.length > 0){

    //run through symbolArray and remove anything contained in the remove list
    //return new Symbols array
    var  newSymbolsArray = availableSymbols.filter(function( el ){
      return symbolsToRemove.indexOf( el ) < 0;
    })

    // console.log('newSymbolsArray: ' + JSON.stringify(newSymbolsArray));
    //return new array
    resolve(newSymbolsArray);
  }else{
    // console.log('nothing to remove, returning full symbols list');
    //nothing to remove, return original availableSymbols array
    resolve(availableSymbols);
  }
  });
}

//removes json object from previousRates objects collection
function removeRateFromPreviousRates(rate){

  let key = Object.keys(rate);

  delete previousRates[key];
}

//adds new object rates to previousRates objects collection
function mergeToPreviousRates(jsonSymbols){

  Object.keys(jsonSymbols).forEach( key =>{

  previousRates[key] = jsonSymbols[key];

  });

  return previousRates;
}

const createUrlList = function(symbolList){
  return new Promise(function(resolve, reject) {

    logger.log({
      level: 'info',
      message: `${today} - Creating new url list`
    });

  //array to keep list of urls to call API
  var urls = [];

//fill urls array for sequential calling
for(i=0; i < symbolList.length; i++){
  url = options.authority +
  options.host +
  options.endpoint +
  options.api +
  options.parameters +
  symbolList[i];
  urls.push(url)
}

// console.log('[createUrlList] urls has: ' + JSON.stringify(urls));

resolve(urls);

})
};

const replaceLocalFileContents = async function(data) {
  //clear file
  fs.writeFile(localRatesFile, "", (err) =>{
    if(err){
      throw err;
    }
  });

  const jsonData = JSON.stringify(data);

  //write new file content
   fs.writeFile(localRatesFile, jsonData, (err) =>{
     if(err){
       throw err;
     }
});

  return;
}

const formatJsonToLocal = function(obj){

  const key = Object.keys(obj);

  var newRate = {};

  newRate.rate = obj[key].val;
  newRate.date = todayFormatted;

  return newRate;
}

//main execution logico which requests urls asyncronously to JSON, adds current Date
// and saves to local txt file
const updateRates = async function(urls) {
  let res = await Promise.all(urls.map(e => fetch(e)));
  let reJson = await Promise.all(res.map(e => e.json()));

  reJson.forEach(rate => {
    // console.log('rate: ' + JSON.stringify(rate));
      // console.log('rate status: ' + rate.status);
    if(rate.status == '400'){
      //do nothing, it's probably an API limit message
      logger.log({
        level: 'error',
        message: `${today} - ${JSON.stringify(rate)}`
      });
    }else{
      //log the rate for further processing
      //firstly format incoming JSON object to be compatible with current local json
      const key = Object.keys(rate);

      //fomrat and add to jsonMain
      jsonMain[key] = formatJsonToLocal(rate);

      //remove from previousRates
      removeRateFromPreviousRates(rate);
  }
}

);

    //check if there was any calls to API done before making changes to local file
    if(reJson.length > 0){

    // console.log('jsonMain: ' + JSON.stringify(jsonMain));

    jsonSymbols.symbols = mergeToPreviousRates(jsonMain);

    logger.log({
      level: 'info',
      message: `${today} - Saving ${reJson.length} new objects to local file`
    });

      //All processing done, pass data to local txt file
      replaceLocalFileContents(jsonSymbols);

      console.log('New data saved locally.');

    }else{

      logger.log({
        level: 'info',
        message: `${today} - No new data to save locally.`
      });

      console.log('No new data returned.');

    }

}// end asnyc()


getSymbolsToRemoveList.then((ratesToRemove) => removeElementFromSymbolsArray(ratesToRemove)).then((updatedSymbolsList) => createUrlList(updatedSymbolsList)).then((urls) => updateRates(urls));
