"use strict";

require('dotenv').config();

if (!process.env.LOCALBITCOIN_KEY) {
	process.exit(1);
}
if (!process.env.LOCALBITCOIN_SECRET) {
	process.exit(1);
}

const console = require("better-console");
const later = require('later');
const LBCClient = require('localbitcoins-api');
const request = require('request-promise');

// Setup Localbitcoin client
const lbc = new LBCClient(process.env.LOCALBITCOIN_KEY, process.env.LOCALBITCOIN_SECRET);

// Timing
let checkupSched = later.parse.text('every 5 seconds');

let dontGoUnder = 8200;
let undercutAmount = 10;
let paymentMethod = `SWISH`;
let minimumMaxAmountAvailable = 10000;
let minTradeCount = 100;

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

// Get listed ads
async function getAds() {
	let method = 'buy-bitcoins-online';
	let params = {
		path: 'SEK'
	};
	return apiCall(method, null, params);
}

async function apiCall(method, ad_id, params) {
	// Display user's info
	return new Promise((resolve, reject) => {
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

function checkup() {
	(async () => {

		try {
			let user = await getUser();

			// Get our own ad(s) id(s).
			let userAds = await getUserAds();
			let userAdList = userAds.ad_list;
			let userAdIds = userAdList.map((ad) => {
				return ad.data.ad_id;
			});

			// Get the current SEK ads.
			let allAds = await getAds();
			let adList = allAds.ad_list;

			// Get our own ad(s).
			let userSEKAdList = adList.filter((ad) => {
				return userAdIds.includes(ad.data.ad_id);
			});

			// Filter out our own ad.
			adList = adList.filter((ad) => {
				return userAdIds.includes(ad.data.ad_id) == false;
			});
			// Filter out those not using our preferred payment method.
			adList = adList.filter((ad) => {
				return ad.data.online_provider == paymentMethod;
			});
			// Filter out ads not competing in trade bulk.
			adList = adList.filter((ad) => {
				return ad.data.max_amount_available > minimumMaxAmountAvailable;
			});

			// If we are in the top three, only compete with those
			// with a significant number of trades.
			let inTopThree = false;
			for (let i = 0; i < adList.length; i++) {
				if (i < 3) {
					if (userAdIds.includes(adList[i].data.ad_id)) {
						inTopThree = true;
					}
				}
			}
			if (inTopThree) {
				adList = adList.filter((ad) => {
					let trade_count = ad.data.profile.trade_count.replace(/\+$/, '');
					return trade_count > minTradeCount;
				});
			}

			console.log("user ads");
			for (var i = adList.length - 1; i >= 0; i--) {
				let data = adList[i].data
				console.log(data.ad_id, data.profile.username);
			}

			console.log("user ads");
			for (var i = userAdList.length - 1; i >= 0; i--) {
				let data = userAdList[i].data
				console.log(data.ad_id, data.profile.username);
			}

		} catch(e) {
			console.log(e);
		}

	})();
}

checkup();

// Run it all
// let checkupTimer = later.setInterval(checkup, checkupSched);
