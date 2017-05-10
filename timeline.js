var list = new Vue({
	el: "#list",
	data: {
		adverts: [{ // Load from server as a per-user / party / national endpoint
			entity_vanity: "labourparty",
			top_level_post_id: "10154490741072411", // Must be a string, or JS rounding screws the number up
			date_snapshot: 1494308926123
		}, {
			entity_vanity: "conservatives",
			top_level_post_id: "10154960444659279",
			date_snapshot: 1494308926122
		}, {
			entity_vanity: "conservatives",
			top_level_post_id: "10154959906249279",
			date_snapshot: 1494108926412
		}, {
			entity_vanity: "libdems",
			top_level_post_id: "10155319151993270",
			date_snapshot: 1494208926141
		}]
	},
	computed: {
		adsByDay: function() { // Group adverts received by day, according to `date_snapshot` (time seen by user)
			return this.adverts.reduce(function(acc, d) {
					d.posturl = "https://www.facebook.com/" + d.entity_vanity + "/posts/" + d.top_level_post_id + "/";
					console.log(d.posturl)
					var p = new Date(d.date_snapshot)
					if (!acc[0].hasOwnProperty(p)) acc[0][p] = [];
					acc[0][p].push(d);
					return acc;
				}, [{}])
				.reduce(function(acc, v) {
					Object.keys(v).forEach(function(k) {
						acc.push({
							date: new Date(k),
							ads: v[k]
						})
					});
					return acc;
				}, [])
				.sort((a, b) => b.date - a.date); // Most recent first
		}
	}
})
