const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });
const { getDateString } = require('./utils');

// initialize admin SDK
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();



/* USER FUNCTIONS */

exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        paymentData: {},
        auctionWins: {}
    });
});

exports.removeUser = functions.auth.user().onDelete(user => {
    return db.collection('users').doc(user.uid).delete();
});



/* PROFILE FUNCTIONS */

exports.getProfile = functions.https.onRequest((request, response) => {

    // fetch profile data
    const date = getDateString();
    db.collection('profiles').doc(date).get()
    .then(profile => {

        // send profile data
        if (profile.exists) {
            cors(request, response, () => {
                response.send({ 
                    error: false, 
                    profile: profile.data()
                });
            });
        }
        else {
            cors(request, response, () => {
                response.send({ 
                    error: true 
                });
            });
        }
    });
});

/* AUCTION FUNCTIONS */

