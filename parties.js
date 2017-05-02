$(document).ready(function() {
	$.getJSON("parties.json", function(partyJSON) {
		// UI controller

		Vue.component('advertiser-table', {
			template: "#advertiser-table",
			props: ['data','parties']
		})

		var App = new Vue({
			el: '#app',
			data: {
				advertisers: [ // To be loaded from the DB
					{
						"advertiser_id": "184415805090230",
						"advertiser": "BrightInfo",
						"count": 2,
						"profile_photo": "http://graph.facebook.com/184415805090230/picture?type=square",
						"political": 'true',
						"affiliation": 'labour',
						"touchedDate": ''
					},
					{
						"advertiser_id": "6243987495",
						"advertiser": "Spotify",
						"count": 3,
						"profile_photo": "http://graph.facebook.com/6243987495/picture?type=square",
						"political": 'true',
						"affiliation": 'conservative',
						"touchedDate": ''
					},
					{
						"advertiser_id": "143021112391265",
						"advertiser": "Jacobin Magazine",
						"count": 2,
						"profile_photo": "http://graph.facebook.com/143021112391265/picture?type=square",
						"political": 'true',
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
				parties: partyJSON, // To be loaded from the DB
				adverts: [ // Load actual advert data, or provide partyAds, partyColours numbers (see below)
					/* e.g.
						politicalAds = [{ "x": "political", "y": 26, "_id": 740 }, { "x": "nonpolitical", "y": 7, "_id": 741 } ]
						partyAds = [ { "x": "green", "y": 6, "color": "6AB023", "_id": 1067 }, { "x": "labour", "y": 12, "color": "DC241f", "_id": 1068 }, { "x": "dup", "y": 8, "color": "D46A4C", "_id": 1069 } ]
					*/
					{advertiser_id:34329506713},
					{advertiser_id:34329506713},
					{advertiser_id:34329506713},
					{advertiser_id:34329506713},
					{advertiser_id:34329506713},
					{advertiser_id:34329506713},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:143021112391265},
					{advertiser_id:184415805090230},
					{advertiser_id:184415805090230},
					{advertiser_id:184415805090230},
					{advertiser_id:184415805090230},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:144372163428},
					{advertiser_id:6243987495},
					{advertiser_id:6243987495},
					{advertiser_id:6243987495}
				]
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
						this.$forceUpdate();
						graph();
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
				},
				politicalAds: function() {
					var App = this;
					var politicalStats = [{
							x: "political",
							y: App.adverts.filter(function(ad) {
									return App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).political == "true"
								}).length
						}, {
							x: "nonpolitical",
							y: App.adverts.filter(function(ad) {
									return App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).political != "true"
								}).length
						}
					]
					console.log(politicalStats)
					return politicalStats;
				},
				partyAds: function() {
					var App = this;
					var partyStats = {}
					App.adverts.forEach(function(ad) {
						var party = App.advertisers.find((entity)=> entity.advertiser_id == ad.advertiser_id).affiliation
						if(party != '') {
							if(partyStats[party] == undefined) partyStats[party] = {x:party, y:0};
							partyStats[party].y++;
							var foundParty = App.parties[1].list.find((p)=>p.id==party);
							partyStats[party].color = foundParty != undefined && foundParty != null ? "#"+foundParty.srgb : 'gray';
						}
						/*else {
							if(partyStats["Neutral"] == undefined) partyStats["Neutral"] = {x:"Neutral", y:0};
							partyStats["Neutral"].y++;
							partyStats["Neutral"].color = "gray"
						}*/
					})
					var result = []
					Object.keys(partyStats).forEach(function(party) {
						result.push(partyStats[party]);
					});
					console.log(result)
					return result;
				},
				partyColours: function() {
					return this.partyAds.map((party) => party.color);
				}
			}
		});

		graph();

		$( window ).resize(() => graph() );

		function graph() {
			vega.embed("#political", {
				"$schema": "https://vega.github.io/schema/vega-lite/v2.json",
				"width": $("#political").width() * 0.8,
				"height": 150,
				"data": {
					"values": App.politicalAds
				},
				"mark": "bar",
				"encoding": {
					"y": {"field": "x", "type": "nominal", "axis": { "domain": false, "title": "", "labelPadding": 10 } },
					"x": {"field": "y", "type": "quantitative", "axis": { "domain": false, "title": "" } },
					"color": {
					  "field": "x",
					  "type": "nominal",
					  "scale": {"range": ["gray","red"]},
					  "legend": false
					}
				},
				"config": { "axis": { "labelFont": "lato", "ticks": false, "labelFontSize": 14, "labelColor":"#777" } }
				}, {
					"mode": "vega-lite",
					"actions": false,
					"config": {
						"autosize": { "type": "fit", "resize": true }
					}
				}, function(error, result) {
				});

			vega.embed("#parties", {
				"$schema": "https://vega.github.io/schema/vega-lite/v2.json",
				"width": $("#parties").width() * 0.8,
				"height": 150,
				"data": {
					"values": App.partyAds
				},
				"mark": "bar",
				"encoding": {
					"y": {"field": "x", "type": "nominal", "axis": { "domain": false, "title": "", "labelPadding": 10 } },
					"x": {"field": "y", "type": "quantitative", "axis": { "domain": false, "title": "" } },
					"color": {
					  "field": "x",
					  "type": "nominal",
					  "scale": {"range": App.partyColours},
					  "legend": false
					}
				},
				"config": { "axis": { "labelFont": "lato", "ticks": false, "labelFontSize": 14, "labelColor":"#777" } }
			}, {
				"mode": "vega-lite",
				"actions": false,
				"config": {
					"autosize": { "type": "fit", "resize": true }
				}
			}, function(error, result) {
			});
		}
	});
});
