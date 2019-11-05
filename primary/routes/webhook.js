const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const logger = require('log4js').getLogger();
const webpush = require('web-push');
const utilities = require('../utilities');

//Create Express app for webhooks
const webhook = module.exports = express();
const router = express.Router();

//bodyParser config
const options = {
	extended: false,
	verify: function(req, res, buf, encoding) {
		
		const secret = 'BHNtFFA2F_9RzeU4PjOXkeCpIrIcZ3J0L0SYA6uWPkLuFwSw_AOJnpJPBzumbbv2SULKjxzT73cVfAn4cyyvIYQ';
		const hash = crypto.createHmac('sha1', secret)
		.update(buf)
		.digest('hex');
		
		logger.info(`X-TBA-Checksum: ${req.header('X-TBA-Checksum')}`);
		console.log(`Our hash: ${hash}`);		
    }
};
webhook.use(bodyParser.json(options));
webhook.use(bodyParser.urlencoded(options));

webhook.use('/', router);

//Routing
router.get('/', async function(req, res) {
	
	logger.info(JSON.stringify(req.query));
	
	res.send(req.query);
	
});

router.post('/', async function(req, res) {
	
	logger.info(JSON.stringify(req.body));
		
	var message = req.body;
	var messageType = message.message_type;
	var messageData = message.message_data;
	
	//Delegate data handling to separate functions.
	switch(messageType){
		
		case "upcoming_match":
			handleUpcomingMatch( messageData );
			break;
		case "match_score":
			handleMatchScore( messageData );
			break;
		case "starting_comp_level":
			handleStartingCompLevel( messageData );
			break;
		case "alliance_selection":
			handleAllianceSelection( messageData );
			break;
		case "schedule_updated":
			handleScheduleUpdated( messageData );
			break;
		case "awards_posted":
			handleAwardsPosted( messageData );
			break;
	}
	
	res.status(200).send("thanks!");
});

//TBA push handlers
async function handleUpcomingMatch( data ){
	if (process.env.disablePushNotifications == 'true') return;
	
	const thisFuncName = 'webhook/handleUpcomingMatch: ';
	
	logger.debug(`${thisFuncName} Configuring web-push`);
	const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});
	webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
	
	const teamKeys = data.team_keys;
	const matchNumberKey = data.match_key.split('_')[1];
	logger.debug(`${thisFuncName} matchNumberKey: ${matchNumberKey}, teamKeys: ${JSON.stringify(teamKeys)}`);
	
	for (var teamKey of teamKeys) {
		//find assignee of this team key
		const alliance = 'red';
		const assigneeID = '5d9cd6951c4f783330139549';
		const user = await utilities.findOne('users', {_id: assigneeID});
		
		logger.info(`${thisFuncName} Asignee: ${JSON.stringify(user)}`);
		
		//if user is found in the db, proceed
		if (user) {
			//if user has a push subscription, then send to that subscription
			if (user.push_subscription) {
				const pushSubscription = user.push_subscription;
				
				var titleIdentifier;
				var matchNumber, compLevel;
				var setNumber = '';
				
				//comp_level isn't available in upcoming_match notification, so we have to find it ourselves
				if (matchNumberKey.substring(0, 2) == 'qm') {
					compLevel = 'qm';
					matchNumber = matchNumberKey.substring(2);
					titleIdentifier = `Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 2) == 'qf') {
					compLevel = 'qf';
					setNumber = matchNumberKey.substring(2, 3);
					matchNumber = matchNumberKey.substring(4);
					titleIdentifier = `Quarterfinal ${setNumber} Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 2) == 'sf') {
					compLevel = 'sf';
					setNumber = matchNumberKey.substring(2, 3);
					matchNumber = matchNumberKey.substring(4);
					titleIdentifier = `Semifinal ${setNumber} Match ${matchNumber}`;
				}
				else if (matchNumberKey.substring(0, 1) == 'f') {
					compLevel = 'f';
					matchNumber = matchNumberKey.substring(3);
					titleIdentifier = `Final Match ${matchNumber}`;
				} 
				else {
					throw new Error(`${thisFuncName} Unexpected matchKey comp_level identifier`);
				}
				
				var imageHref = 'https://upload.scoutradioz.com/app/generate/upcomingmatch?'
					+ `match_number=${matchNumber}&comp_level=${compLevel}&set_number=${setNumber}`
					+ `&blue1=${teamKeys[0].substring(3)}`
					+ `&blue2=${teamKeys[1].substring(3)}`
					+ `&blue3=${teamKeys[2].substring(3)}`
					+ `&red1=${teamKeys[3].substring(3)}`
					+ `&red2=${teamKeys[4].substring(3)}`
					+ `&red3=${teamKeys[5].substring(3)}`
					+ `&assigned=red1`;
				
				const notificationContent = JSON.stringify({
					title: `${titleIdentifier} will start soon`,
					options: {
						body: `You're assigned to team ${teamKey.substring(3)} on the ${alliance} alliance.`,
						badge: '/images/monochrome-badge.png',
						icon: '/images/FIRST-logo.png',
						image: imageHref,
						actions: [
							{
								action: 'scout-match',
								title: 'Scout Match',
								//icon: '',
							}
						]
					},
					ifFocused: {
						message: "Don't forget! This is a reminder!"
					},
				});
				// https://web-push-book.gauntface.com/demos/notification-examples/ 
				
				await sendPushMessage(pushSubscription, notificationContent);
			}
			else {
				logger.debug(`${thisFuncName} Push subscription not available for ${req.user.name}`);
		
			}
		}
	}
}

async function handleMatchScore( data ){
	
}

async function handleStartingCompLevel( data ){
	
}

async function handleAllianceSelection( data ){
	
}

async function handleScheduleUpdated( data ){
	
}

async function handleAwardsPosted( data ){
	
}

//Push notification functions

async function sendPushMessage (subscription, dataToSend) {
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		var result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err) {
		
		if (err.statusCode == 404 || err.statusCode == 410) {
			logger.warn(`Subscription has expired or is no longer valid: `, err);
		}
		
		logger.error(err);
	}
}

/*
{
	"message_type": "upcoming_match",
	"message_data": {
		"scheduled_time": 1397330280,
		"match_key": "2014necmp_f1m1",
		"team_keys": [
			"frc195",
			"frc558",
			"frc5122",
			"frc177",
			"frc230",
			"frc4055"
		],
		"predicted_time": null,
		"event_name": "New England FRC Region Championship",
		"webcast": null,
		"event_key": "2014necmp"
	}
}
{
	"message_type": "match_score",
	"message_data": {
		"event_name": "New England FRC Region Championship",
		"event_key": "2014necmp",
		"match": {
			"comp_level": "f",
			"match_number": 1,
			"videos": [
				{
					"type": "youtube",
					"key": "ZRTRszl2iXw"
				},
				{
					"type": "youtube",
					"key": "7kcrVlataCA"
				},
				{
					"type": "youtube",
					"key": "-ijeqxwp7EI"
				}
			],
			"time_string": "3:18 PM",
			"set_number": 1,
			"key": "2014necmp_f1m1",
			"time": 1397330280,
			"score_breakdown": null,
			"alliances": {
				"blue": {
					"surrogates": [],
					"score": 154,
					"dqs": [],
					"teams": [
						"frc177",
						"frc230",
						"frc4055"
					]
				},
				"red": {
					"surrogates": [],
					"score": 78,
					"dqs": [],
					"teams": [
						"frc195",
						"frc558",
						"frc5122"
					]
				}
			},
			"event_key": "2014necmp"
		}
	}
}
{
	"message_type": "starting_comp_level",
	"message_data": {
		"event_name": "New England FRC Region Championship",
		"comp_level": "f",
		"event_key": "2014necmp",
		"scheduled_time": 1397330280
	}
}
{
	"message_type": "alliance_selection",
	"message_data": {
		"event_name": "FIRST Mid-Atlantic District Championship",
		"event_key": "2019mrcmp",
		"event": {
			"key": "2019mrcmp",
			"website": "http://www.midatlanticrobotics.com/",
			"official": true,
			"end_date": "2019-04-06",
			"name": "FIRST Mid-Atlantic District Championship",
			"short_name": "Mid-Atlantic",
			"facebook_eid": null,
			"event_district_string": "FIRST Mid-Atlantic",
			"venue_address": "Lehigh University - Stabler Arena\n124 Goodman Drive\nBethlehem, PA 18015\nUSA",
			"event_district": 0,
			"week": 5,
			"location": "Bethlehem, PA 18015, USA",
			"event_code": "mrcmp",
			"year": 2019,
			"webcast": [
				{
					"date": "2019-04-06",
					"type": "youtube",
					"channel": "40cpnLMS-gM"
				},
				{
					"date": "2019-04-04",
					"type": "youtube",
					"channel": "Qv0MN-93-jc"
				},
				{
					"date": "2019-04-05",
					"type": "youtube",
					"channel": "nWhw2WODVxg"
				},
				{
					"type": "twitch",
					"channel": "firstmidatl_red"
				}
			],
			"timezone": "America/New_York",
			"alliances": [
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 1",
					"picks": [
						"frc303",
						"frc1807",
						"frc708"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 2",
					"picks": [
						"frc225",
						"frc747",
						"frc5401"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 3",
					"picks": [
						"frc1923",
						"frc222",
						"frc1403"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 4",
					"picks": [
						"frc56",
						"frc1676",
						"frc25"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 5",
					"picks": [
						"frc2607",
						"frc11",
						"frc1279"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 6",
					"picks": [
						"frc365",
						"frc1640",
						"frc2729"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 7",
					"picks": [
						"frc5992",
						"frc103",
						"frc834"
					]
				},
				{
					"declines": [],
					"backup": null,
					"name": "Alliance 8",
					"picks": [
						"frc2577",
						"frc5895",
						"frc2590"
					]
				}
			],
			"event_type_string": "District Championship",
			"start_date": "2019-04-03",
			"event_type": 2
		}
	}
}
{
	"message_type": "schedule_updated",
	"message_data": {
		"event_name": "New England FRC Region Championship",
		"first_match_time": 1397330280,
		"event_key": "2014necmp"
	}
}
{
	"message_type": "schedule_updated",
	"message_data": {
		"event_name": "FMA District Bridgewater-Raritan Event",
		"first_match_time": 1552762380,
		"event_key": "2019njbri"
	}
}
{
	"message_type": "awards_posted",
	"message_data": {
		"event_name": "New England FRC Region Championship",
		"awards": [
			{
				"event_key": "2014necmp",
				"award_type": 0,
				"name": "Regional Chairman's Award",
				"recipient_list": [
					{
						"awardee": null,
						"team_number": 2067
					},
					{
						"awardee": null,
						"team_number": 78
					},
					{
						"awardee": null,
						"team_number": 811
					},
					{
						"awardee": null,
						"team_number": 2648
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 9,
				"name": "Engineering Inspiration",
				"recipient_list": [
					{
						"team_number": 1735,
						"awardee": null
					},
					{
						"team_number": 3467,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 10,
				"name": "Rookie All Star Award",
				"recipient_list": [
					{
						"awardee": null,
						"team_number": 4925
					},
					{
						"awardee": null,
						"team_number": 4905
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 3,
				"name": "Woodie Flowers Finalist Award",
				"recipient_list": [
					{
						"team_number": 195,
						"awardee": "Sandra Brino"
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 5,
				"name": "Volunteer of the Year",
				"recipient_list": [
					{
						"team_number": null,
						"awardee": "Ellen McIssac"
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 4,
				"name": "FIRST Dean's List Finalist",
				"recipient_list": [
					{
						"team_number": 1519,
						"awardee": "David Gray"
					},
					{
						"team_number": 811,
						"awardee": "Emily Freise"
					},
					{
						"team_number": 1100,
						"awardee": "Manisha Rajaghatta"
					},
					{
						"team_number": 2084,
						"awardee": "Samuel Creighton"
					},
					{
						"team_number": 228,
						"awardee": "Amber Powers"
					},
					{
						"team_number": 78,
						"awardee": "Tyler Fleig"
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 1,
				"name": "Regional Winner",
				"recipient_list": [
					{
						"team_number": 230,
						"awardee": null
					},
					{
						"team_number": 177,
						"awardee": null
					},
					{
						"team_number": 4055,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 2,
				"name": "Regional Finalist",
				"recipient_list": [
					{
						"team_number": 195,
						"awardee": null
					},
					{
						"team_number": 558,
						"awardee": null
					},
					{
						"team_number": 5122,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 20,
				"name": "Creativity Award sponsored by Xerox",
				"recipient_list": [
					{
						"team_number": 1100,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 22,
				"name": "Entrepreneurship Award sponsored by Kleiner Perkins Caufield and Byers",
				"recipient_list": [
					{
						"team_number": 4055,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 21,
				"name": "Excellence in Engineering Award sponsored by Delphi",
				"recipient_list": [
					{
						"team_number": 1519,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 11,
				"name": "Gracious Professionalism Award sponsored by Johnson & Johnson",
				"recipient_list": [
					{
						"team_number": 1153,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 14,
				"name": "Highest Rookie Seed Award",
				"recipient_list": [
					{
						"team_number": 4908,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 27,
				"name": "Imagery Award in honor of Jack Kamen",
				"recipient_list": [
					{
						"team_number": 3930,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 16,
				"name": "Industrial Design Award sponsored by General Motors",
				"recipient_list": [
					{
						"team_number": 195,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 18,
				"name": "Industrial Safety Award sponsored by Underwriters Laboratories",
				"recipient_list": [
					{
						"team_number": 3930,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 29,
				"name": "Innovation in Control Award sponsored by Rockwell Automation",
				"recipient_list": [
					{
						"team_number": 2168,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 13,
				"name": "Judges Award",
				"recipient_list": [
					{
						"team_number": 558,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 17,
				"name": "Quality Award sponsored by Motorola",
				"recipient_list": [
					{
						"team_number": 58,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 15,
				"name": "Rookie Inspiration Award",
				"recipient_list": [
					{
						"team_number": 4909,
						"awardee": null
					}
				],
				"year": 2014
			},
			{
				"event_key": "2014necmp",
				"award_type": 30,
				"name": "Team Spirit Award sponsored by Chrysler",
				"recipient_list": [
					{
						"team_number": 228,
						"awardee": null
					}
				],
				"year": 2014
			}
		],
		"event_key": "2014necmp"
	}
}

*/