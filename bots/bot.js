"use strict";

require('dotenv').config();

if (!process.env.LOCALBITCOIN_KEY) {
	process.exit(1);
}
if (!process.env.LOCALBITCOIN_SECRET) {
	process.exit(1);
}

const later = require('later');
const LBCClient = require('localbitcoins-api');
const request = require('request-promise');

// Setup Localbitcoin client
const lbc = new LBCClient(process.env.LOCALBITCOIN_KEY, process.env.LOCALBITCOIN_SECRET);

// Timing
let checkupSched = later.parse.text('every 5 seconds');

// Get the Localbitcoin user whose key and secret is used.
async function getUser() {
	let method = 'myself';
	return apiCall(method);
}

// Get the Localbitcoin user's ads.
async function getUserAds() {
	let method = 'ads';
	return apiCall(method);
}

async function getCurrencies() {
	let method = 'currencies';
	return apiCall(method);
}

async function getCountryCodes() {
	let method = 'countrycodes';
	return apiCall(method);
}

async function apiCall(method, ad_id, params) {
	// Display user's info
	return new Promise(resolve => {
		lbc.api(method, ad_id, params, function(error, response) {
			if(error) {
				reject(error);
			}
			else {
				resolve(response.data);
			}
		});
	});
}

// Get listed ads
async function getAds() {  
	// const options = {
	// 	method: 'GET',
	// 	// headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
	// 	json: true,
	// 	uri: `https://localbitcoins.com/buy-bitcoins-online/SE/sweden/.json`,
	// 	// form: {
	// 	//   'authentication.userId': `username`,
	// 	//   'amount': cents.toString()
	// 	// }
	// };
	// try {
	// 	const response = await request(options);
	// 	console.log(response);
	// 	return Promise.resolve(response);
	// }
	// catch (error) {
	// 	return Promise.reject(error);
	// }
	let method = 'buy-bitcoins-online';
	let params = {
		path: 'SEK'
	};
	return apiCall(method, null, params);
}

function checkup() {
	(async () => {

		try {
			let user = await getUser();
			// let userAds = await getUserAds();
			// let countrycodes = await getCountryCodes();
			// let currencies = await getCurrencies();
			let ads  = await getAds();

			console.log(ads);

		} catch(e) {
			console.log(e);
		}

	})();
}

// getAds().then((response) => {
// 	let ads = []
// 	try {
// 		ads = response.data.ad_list;
// 	} catch (error) {
// 		console.log(error);
// 	}
// 	for (var i = ads.length - 1; i >= 0; i--) {
// 		console.log(ads[i].data);
// 		console.log(ads[i].data.profile);
// 	}
// })

checkup();

// Run it all
// let checkupTimer = later.setInterval(checkup, checkupSched);
