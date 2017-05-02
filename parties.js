// UI controller

Vue.component('advertiser-table', {
	template: "#advertiser-table",
	props: ['data','parties']
})

var app = new Vue({
	el: '#app',
	data: {
		advertisers: [ // To be loaded from the DB
			{
				"advertiser_id": "6243987495",
				"advertiser": "Spotify",
				"count": 3,
				"profile_photo": "http://graph.facebook.com/6243987495/picture?type=square",
				"political": '',
				"affiliation": '',
				"touchedDate": ''
			},
			{
				"advertiser_id": "184415805090230",
				"advertiser": "BrightInfo",
				"count": 2,
				"profile_photo": "http://graph.facebook.com/184415805090230/picture?type=square",
				"political": '',
				"affiliation": '',
				"touchedDate": ''
			},
			{
				"advertiser_id": "143021112391265",
				"advertiser": "Jacobin Magazine",
				"count": 2,
				"profile_photo": "http://graph.facebook.com/143021112391265/picture?type=square",
				"political": '',
				"affiliation": '',
				"touchedDate": ''
			},
			{
				"advertiser_id": "34329506713",
				"advertiser": "100% Pure New Zealand",
				"count": 2,
				"profile_photo": "http://graph.facebook.com/34329506713/picture?type=square",
				"political": '',
				"affiliation": '',
				"touchedDate": ''
			},
			{
				"advertiser_id": "144372163428",
				"advertiser": "Stratfor",
				"count": 1,
				"profile_photo": "http://graph.facebook.com/144372163428/picture?type=square",
				"political": '',
				"affiliation": '',
				"touchedDate": ''
			}
		],
		parties: {} // To be loaded from the DB
	},
	watch: {
		'advertisers': {
			handler: function(newAds, oldAds) {
				var App = this;
				// Sanitise newArray. For any element with political == 'false' or '', clear element affiliation
				App.advertisers.forEach(function(advertiser,index) {
					if(advertiser.political == 'false' || advertiser.political == '') {
						console.log("Clearing affil for "+advertiser.advertiser)
						App.advertisers[index].affiliation = '';
					}
				})
			},
			deep: true
		}
	},
	computed: {
		advertisersToClassify: function() {
			var result = this.advertisers.filter(function (advertiser) {
				return (
					advertiser.political == '' ||
					(
						advertiser.political == 'true' &&
						advertiser.affiliation == ''
					)
				)
			})
			console.log("To-do",result);
			return result;
		},
		advertisersClassified: function() {
			var result=  this.advertisers.filter(function (advertiser) {
				return (
					advertiser.political == 'false' ||
					(
						advertiser.political == 'true' &&
						advertiser.affiliation != ''
					)
				)
			})
			console.log("Classified",result);
			return result.sort((a,b) => b.touchedDate - a.touchedDate );
		}
	}
});

$.getJSON("parties.json", (json) => {
	app.parties = json
})
