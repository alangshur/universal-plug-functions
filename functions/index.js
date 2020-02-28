const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });
const { getDateString } = require('./utils');

// initialize constants
const SHARD_COUNT = 10;

// initialize admin SDK
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();



/*** USER FUNCTIONS ***/

// (SAFE) (AUTH) (add user to firestore upon creation)
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        paymentData: {},
        auctionWins: {}
    });
});

// (SAFE) (AUTH) (remove user from firestore upon deletion)
exports.removeUser = functions.auth.user().onDelete(user => {
    return db.collection('users').doc(user.uid).delete();
});



/*** PROFILE FUNCTIONS ***/

// (SAFE) (HTTP) (pick random shard on current profile to incremenet view count)
exports.registerView = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // update count on random shard
        const id = Math.floor(Math.random() * SHARD_COUNT);
        const date = getDateString();
        await db.collection('profiles').doc(date + '/viewShards/shard' + id)
            .update({ count: admin.firestore.FieldValue.increment(1) });

        // return https response
        cors(request, response, () => {
            response.send({ success: true });
        });
    }
    catch (err) {
        console.log('registerView: ' + err);
        cors(request, response, () => {
            response.send({ success: false });
        });
    }
});

// (UNSAFE) (HTTP) (create new profile for current date with view shards)
exports.createProfile = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // add new profile
        const date = getDateString();
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
            response.send({ success: true });
        });
    }
    catch (err) {
        console.log('createProfile: ' + err);
        cors(request, response, () => {
            response.send({ success: false });
        });
    }
});

// (SAFE) (SCHEDULE) (accumulate all shard views into total views)
exports.updateViews = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    try {
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
    }
    catch (err) { console.log('updateViews: ' + err); }
});



/* AUCTION FUNCTIONS */

// (SAFE) (post bid to current auction)
exports.bidCurrentAuction = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // enforce authentication
        var targetUser = undefined;
        const token = request.get('Authorization');
        await admin.auth().verifyIdToken(token)
            .then(
                decoded => { targetUser = decoded; }, 
                err => { throw new Error('auth'); }
            );

        // fetch bid data
        const bid = Number(request.get('Bid'));
        if (!bid) throw new Error('bid-r');

        // fetch current auction
        const date = getDateString();
        var auctionRef = db.collection('auctions').doc(date);
        await db.runTransaction(transaction => {
            return transaction.get(auctionRef).then(auction => {
                if (!auction.exists || !auction.data().current) throw new Error('auction');

                // verify bid
                const topBid = auction.data().bid;
                if (bid <= topBid) throw new Error('bid-p');

                // save bid
                const bidCount = auction.data().bidCount;
                var bidsRef = auctionRef.collection('bids').doc(String(bidCount));
                transaction.set(bidsRef, {
                    bid: bid,
                    user: targetUser.user_id
                });

                // update auction
                transaction.update(auctionRef, {
                    bid: bid,
                    bidCount: admin.firestore.FieldValue.increment(1)
                });
            });
        });

        // return https response
        cors(request, response, () => {
            response.send({ success: true });
        });
    }
    catch (err) {
        console.log('getCurrentAuction: ' + err);

        // choose error message
        var message = '';
        switch (err.message) {
            case 'auth': message = 'Error authenticating user. Please sign in.'; break;
            case 'bid-r': message = 'Error retrieving bid. Please wait and try again.'; break;
            case 'bid-p': message = 'Error placing bid. Bid must be greater than top bid.'; break;
            case 'auction': message = 'Error placing bid. The auction has ended.'; break;
            default: message = 'Unexpected server error. Please wait and try again.';
        }

        cors(request, response, () => {
            response.send({
                success: false,
                message: message
            });
        });
    }
});