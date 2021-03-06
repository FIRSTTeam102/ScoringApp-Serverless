const router = require('express').Router();
const logger = require('log4js').getLogger('notifications');
const wrap = require('express-async-handler');
const webpush = require('web-push');
const utilities = require('@firstteam102/scoutradioz-utilities');

router.all('/*', wrap(async (req, res, next) => {
	//Must remove from logger context to avoid unwanted persistent funcName.
	logger.removeContext('funcName');
	next();
}));

router.get('/', wrap(async (req, res) => {
	
	res.render('./notifications', {
		title: 'Subscribing to a notification'
	});
}));

router.post('/save-subscription', wrap(async (req, res) => {
	logger.addContext('funcName', 'save-subscription[post]');
	logger.info('ENTER');
	
	//check if user is logged in as a scouter
	if (!await req.authenticate(process.env.ACCESS_SCOUTER)) return;
	//check if it's a valid save request
	if (!await isValidSaveRequest(req, res)) {
		res.setHeader('Content-Type', 'application/json');
		return res.send({data: {success: false}});
	}
	
	logger.info(`Request to save push notification subscription for ${req.user.name}`);
	logger.debug(`body: ${JSON.stringify(req.body)}`);
	
	var pushSubscription = req.body;
	
	var writeResult = await utilities.update('users', {_id: req.user._id}, {$set: {push_subscription: pushSubscription}});
	
	logger.trace(`writeResult: ${JSON.stringify(writeResult)}`);
	
	//if user has been updated w/ push subscription, then send a success message
	if (writeResult.ok){
		
		logger.debug('Success');
		
		res.cookie('enable_notifications', 1);
		
		res.setHeader('Content-Type', 'application/json');
		res.send({data: {success: true}});
	}
	//if write result failed, then error out and send fail response
	else {
		logger.error('The subscription was received but we were unable to save it to our database.');
		
		res.status(500);
		res.setHeader('Content-Type', 'application/json');
		res.send({
			error: {
				id: 'unable-to-save-subscription',
				message: 'The subscription was received but we were unable to save it to our database.'
			}
		});
	}
}));

router.post('/disable-subscription', wrap(async (req, res) => {
	logger.addContext('funcName', 'disable-subscription[post]');
	logger.info('ENTER');
	
	var writeResult = await utilities.update('users', {_id: req.user._id}, {$set: {push_subscription: {}}});
	
	logger.debug(JSON.stringify(writeResult));
	logger.info('Success');
		
	res.clearCookie('enable_notifications');
	
	res.setHeader('Content-Type', 'application/json');
	res.send({data: {success: true}});
}));

router.post('/sendtest', wrap(async (req, res) => {
	logger.addContext('funcName', 'sendtest[post]');
	logger.info('ENTER');
	
	//check if user is logged in as a scouter
	if (!await req.authenticate(process.env.ACCESS_SCOUTER)) return;
	
	const keys = await utilities.findOne('passwords', {name: 'web_push_keys'});	
	webpush.setVapidDetails('mailto:roboticsfundinc@gmail.com', keys.public_key, keys.private_key);
	
	const notificationBody = req.body.content != '' ? req.body.content : 'Hello world!';
	
	const pushSubscription = req.user.push_subscription;
	
	if (pushSubscription){
		
		const notificationContent = JSON.stringify({
			title: 'Match 24 is about to start',
			options: {
				body: 'You\'re assigned to team 4261 on the red alliance.',
				badge: '/images/brand-logos/monochrome-badge.png',
				icon: '/images/brand-logos/FIRST-logo.png',
				image: 'https://upload.scoutradioz.com/app/generate/upcomingmatch?match_number=24&comp_level=qm&set_number=2&blue1=225&blue2=102&blue3=1676&red1=11&red2=2590&red3=4261&assigned=red3',
				actions: [
					{
						action: 'scout-match',
						title: 'Scout Match',
						//icon: '',
					}
				]
			},
			ifFocused: {
				message: 'Don\'t forget! This is a reminder!'
			},
		});
		// https://web-push-book.gauntface.com/demos/notification-examples/ 
		
		await sendPushMessage(pushSubscription, notificationContent);
		
	}
	else {
		logger.debug(`Push subscription not available for ${req.user.name}`);
	}
	
	res.redirect('/notifications');
}));

async function sendPushMessage (subscription, dataToSend) {
	
	logger.debug(`Attempting to send push message: ${dataToSend}`);
	
	try {
		var result = await webpush.sendNotification(subscription, dataToSend);
		
		logger.debug(`Result: ${JSON.stringify(result)}`);
	}
	catch (err) {
		
		if (err.statusCode == 404 || err.statusCode == 410) {
			logger.warn('Subscription has expired or is no longer valid: ', err);
		}
		
		logger.error(err);
	}
}

async function isValidSaveRequest (req, res) {
	
	// Check the request body has at least an endpoint
	if (!req.body || !req.body.endpoint) {
		// Not a valid subscription.
		res.status(400);
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify({
			error: {
				id: 'no-endpoint',
				message: 'Subscription must have an endpoint.'
			}
		}));
		return false;
	}
	return true;
}

module.exports = router;