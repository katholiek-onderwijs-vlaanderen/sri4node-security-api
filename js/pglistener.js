// Based on following code:
// https://github.com/vitaly-t/pg-promise/wiki/Robust-Listeners

const { debug, error } = require('sri4node/js/common.js')

exports = module.exports = function (db, funToRunAtNotification) {
    const channel = 'sri4node-security-api'; // LISTEN - channel name
    const msg = 'clearMem';
    let connection; // global connection for permanent event listeners
    let counter = 0; // payload counter, just for kicks


    function onNotification(data) {
        if (data.payload === msg) {
            funToRunAtNotification();
        }
    }

    function setupListeners(client) {
        client.on('notification', onNotification);
        return connection.none('LISTEN ${channel:name}', { channel })
            .catch(err => {
                error(err); // unlikely to ever happen
            });
    }

    function removeListeners(client) {
        client.removeListener('notification', onNotification);
    }

    function onConnectionLost(err, e) {
        error('sri4node-security-api | pglistener - connectivity problem:')
        error(err);
        connection = null; // prevent use of the broken connection
        removeListeners(e.client);
        reconnect(5000, 10) // retry 10 times, with 5-second intervals
            .then(() => {
                debug('sri4node-security-api', 'pglistener - successfully reconnected.');
            })
            .catch(() => {
                // failed after 10 attempts
                error('sri4node-security-api', 'pglistener - Connection Lost Permanently -> exiting.');
                process.exit(); // exiting the process
            });
    }

    function reconnect(delay, maxAttempts) {
        delay = delay > 0 ? parseInt(delay) : 0;
        maxAttempts = maxAttempts > 0 ? parseInt(maxAttempts) : 1;
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                db.connect({ direct: true, onLost: onConnectionLost })
                    .then(obj => {
                        connection = obj; // global connection is now available
                        resolve(obj);
                        return setupListeners(obj.client);
                    })
                    .catch(err => {
                        error('sri4node-security-api | pglistener - error reconnecting:')
                        error(err);
                        if (--maxAttempts) {
                            reconnect(delay, maxAttempts)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            reject(err);
                        }
                    });
            }, delay);
        });
    }


    function sendNotification() {
        connection.none('NOTIFY ${channel:name}, ${payload}', { channel, payload: msg })
            .catch(err => {  // unlikely to ever happen
                error('sri4node-security-api | pglistener - failed to Notify:');
                error(err);
            })
    }

    reconnect() // = same as reconnect(0, 1)
        .then(obj => {
            debug('sri4node-security-api', 'pglistener - successful initial connection');
        })
        .catch(err => {
            error('sri4node-security-api', 'pglistener - failed initial connection:');
            error(err);
        });

    return {
        sendNotification
    }
};