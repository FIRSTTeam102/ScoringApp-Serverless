/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
self.addEventListener('push', function(event) {
	if (event.data) {
		console.log('This push event has data: ', event.data.text());
	}
	else {
		console.log('This push event has no data.');
	}
	const messageJSON = event.data.json();
	
	const promiseChain = isClientFocused()
		.then((clientIsFocused) => {
		
			// Client isn't focused, we need to show a notification.
			return self.registration.showNotification(messageJSON.title, messageJSON.options)
				.then(() => {
					if (clientIsFocused) {
						console.log('Don\'t need to show a notification.');
				
						//Post message to client window
						return postMessageToClient(messageJSON);
					}
				});
		});
	
	event.waitUntil(promiseChain);
});

function postMessageToClient(message){
	return clients.matchAll({
		type: 'window',
		includeUncontrolled: true
	})
		.then((windowClients) => {
			windowClients.forEach((windowClient) => {
				windowClient.postMessage(message);
			});
		});
}

function isClientFocused() {
	return clients.matchAll({
		type: 'window',
		includeUncontrolled: true
	})
		.then((windowClients) => {
			let clientIsFocused = false;
	
			for (let i = 0; i < windowClients.length; i++) {
				const windowClient = windowClients[i];
				if (windowClient.focused) {
					clientIsFocused = true;
					break;
				}
			}
	
			return clientIsFocused;
		});
}