const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });
const { getDateString } = require('./utils');

// initialize admin SDK
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// initialize constants
const SHARD_COUNT = 10;



/*** USER FUNCTIONS ***/

// (AUTH) (add user to firestore upon creation)
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        paymentData: {},
        auctionWins: {}
    });
});

// (AUTH) (remove user from firestore upon deletion)
exports.removeUser = functions.auth.user().onDelete(user => {
    return db.collection('users').doc(user.uid).delete();
});



/*** PROFILE FUNCTIONS ***/

// (HTTP) (pick random shard on current profile to incremenet view count)
exports.registerView = functions.https.onRequest(async (request, response) => {
    try {
        const id = Math.floor(Math.random() * SHARD_COUNT);
        const date = getDateString();

        // update count on random shard
        await db.collection('profiles').doc(date + '/viewShards/shard' + id)
            .update({ count: admin.firestore.FieldValue.increment(1) });

        // return https response
        cors(request, response, () => {
            response.send({ error: false });
        });
    }
    catch (err) {
        console.log('registerView: ' + err);
        cors(request, response, () => {
            response.send({ error: true });
        });
    }
});

// (HTTP) (create new profile for current date with view shards)
exports.createProfile = functions.https.onRequest(async (request, response) => {
    try {
        const date = getDateString();

        // add new profile
        await db.collection('profiles').doc(date).set({
            date: date,
            current: true,
            views: 0,
            title: 'Alex Langshur',
            color: 'lightblue',
            imageLink: 'https://i.imgur.com/IHAoMzT.png',
            videoLink: 'https://streamable.com/bwkxc',
            text: 'Test text.',
            link1: { link: 'http://www.instagram.com', media: 'instagram', text: 'alangshur' },
            link2: { link: 'http://www.youtube.com', media: 'youtube', text: 'alexlangshur' },
            link3: { link: 'http://www.google.com', media: 'website', text: 'alexlangshur.com' },
        })
            .then(async () => {

                // add view shards to sub-collection
                const viewShardsRef = db.collection('profiles').doc(date).collection('viewShards');
                for (var i = 0; i < SHARD_COUNT; i++) {
                    await viewShardsRef.doc('shard' + i).set({ count: 0 });
                }
            });

        // return https response
        cors(request, response, () => {
            response.send({ error: false });
        });
    }
    catch (err) {
        console.log('createProfile: ' + err);
        cors(request, response, () => {
            response.send({ error: true });
        });
    }
});

// (SCHEDULE) (accumulate all shard views into total views)
exports.updateViews = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const date = getDateString();
    var totalCount = 0;

    // count view shards
    await db.collection('profiles/' + date + '/viewShards').get().then(shards => {
        shards.forEach(shard => {
            totalCount += shard.data().count;
        });
    });

    // update total views
    return db.collection('profiles').doc(date).update({ views: totalCount });
});



/* AUCTION FUNCTIONS */

// (get current auction)
exports.getCurrentAuction = functions.https.onRequest(async (request, response) => {
    try {

        // enforce authentication
        const token = request.get('Authorization').split('Bearer ')[1];
        await admin.auth().verifyIdToken(token)
            .catch(err => { throw 'Not authorized'; });

        const date = getDateString();
        console.log(date);

        cors(request, response, () => {
            response.send({ error: true });
        });
    }
    catch (err) {
        console.log('getCurrentAuction: ' + err);
        cors(request, response, () => {
            response.send({ error: true });
        });
    }
});