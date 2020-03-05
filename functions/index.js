const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });
const { 
    getDateString,
    getNextDateString,
    getPreviousDateString,
    validateProfile
} = require('./utils');

// initialize constants
const SHARD_COUNT = 10;

// initialize admin SDK
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();





/*** USER FUNCTIONS ***/

// (AUTH) add user to firestore upon creation
exports.addUser = functions.auth.user().onCreate(user => {
    return db.collection('users').doc(user.uid).set({
        paymentData: {},
        auctionWins: {}
    });
});

// (AUTH) remove user from firestore upon deletion
exports.removeUser = functions.auth.user().onDelete(user => {
    return db.collection('users').doc(user.uid).delete();
});





/*** PROFILE FUNCTIONS ***/

// (HTTP) pick random shard on current profile to incremenet view count
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

// (HTTP) pick random shard on current profile to incremenet heart count
exports.registerHearts = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // fetch heart count
        const count = Number(request.get('Count'));
        if (!count) throw new Error('Cannot retrieve count.');

        // update count on random shard
        const id = Math.floor(Math.random() * SHARD_COUNT);
        const date = getDateString();
        await db.collection('profiles').doc(date + '/heartShards/shard' + id)
            .update({ count: admin.firestore.FieldValue.increment(count) });

        // return https response
        cors(request, response, () => {
            response.send({ success: true });
        });
    }
    catch (err) {
        console.log('registerHearts: ' + err);
        cors(request, response, () => {
            response.send({ success: false });
        });
    }
});

// (HTTP) pick random shard on current profile to incremenet cross count
exports.registerCrosses = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // fetch cross count
        const count = Number(request.get('Count'));
        if (!count) throw new Error('Cannot retrieve count.');

        // update count on random shard
        const id = Math.floor(Math.random() * SHARD_COUNT);
        const date = getDateString();
        await db.collection('profiles').doc(date + '/crossShards/shard' + id)
            .update({ count: admin.firestore.FieldValue.increment(count) });

        // return https response
        cors(request, response, () => {
            response.send({ success: true });
        });
    }
    catch (err) {
        console.log('registerCrosses: ' + err);
        cors(request, response, () => {
            response.send({ success: false });
        });
    }
});

// (SCHEDULE) create new profile for current date with view shards
exports.createProfile = functions.pubsub.schedule('0 0 * * *')
    .timeZone('America/Los_Angeles').onRun(async context => {
        try {
            const date = getDateString();
            const previousDate = getPreviousDateString();
            const profileRef = db.collection('profiles').doc(previousDate);

            // update old profile status
            await profileRef.update({ current: false });

            // add new profile
            await db.collection('profiles').doc(date).set({
                date: date,
                current: true,
                set: false,
                views: 0,
                hearts: 0,
                crosses: 0,
                title: '',
                imageLink: '',
                videoLink: '',
                text: '',
                link1: { link: '', media: '', text: '' },
                link2: { link: '', media: '', text: '' },
                link3: { link: '', media: '', text: '' }
            })
                .then(async () => {

                    // add view shards to sub-collection
                    const viewShardsRef = db.collection('profiles').doc(date).collection('viewShards');
                    for (var i = 0; i < SHARD_COUNT; i++) {
                        await viewShardsRef.doc('shard' + i).set({ count: 0 });
                    }

                    // add heart shards to sub-collection
                    const heartShardsRef = db.collection('profiles').doc(date).collection('heartShards');
                    for (var i = 0; i < SHARD_COUNT; i++) {
                        await heartShardsRef.doc('shard' + i).set({ count: 0 });
                    }

                    // add cross shards to sub-collection
                    const crossShardsRef = db.collection('profiles').doc(date).collection('crossShards');
                    for (var i = 0; i < SHARD_COUNT; i++) {
                        await crossShardsRef.doc('shard' + i).set({ count: 0 });
                    }
                });
        }
        catch (err) { console.log('createProfile: ' + err); }
    });

// (SCHEDULE) accumulate all shards into total views/hearts/counts
exports.updateCounts = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    try {
        const date = getDateString();
        var totalViewCount = 0;
        var totalHeartCount = 0;
        var totalCrossCount = 0;

        // count view shards
        await db.collection('profiles/' + date + '/viewShards').get().then(shards => {
            shards.forEach(shard => {
                totalViewCount += shard.data().count;
            });
        });

        // count heart shards
        await db.collection('profiles/' + date + '/heartShards').get().then(shards => {
            shards.forEach(shard => {
                totalHeartCount += shard.data().count;
            });
        });

        // count cross shards
        await db.collection('profiles/' + date + '/crossShards').get().then(shards => {
            shards.forEach(shard => {
                totalCrossCount += shard.data().count;
            });
        });

        // update total views
        return db.collection('profiles').doc(date).update({ 
            views: totalViewCount,
            hearts: totalHeartCount,
            crosses: totalCrossCount
        });
    }
    catch (err) { console.log('updateCounts: ' + err); }
});

// (HTTP) set current profile
exports.setProfile = functions.https.onRequest(async (request, response) => {
    try {
        const date = getDateString();
        const previousDate = getPreviousDateString();

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // enforce authentication
        var userId = undefined;
        const token = request.get('Authorization');
        await admin.auth().verifyIdToken(token)
            .then(
                decoded => { userId = decoded.user_id; }, 
                err => { throw new Error('auth'); }
            );

        // enforce winning user
        const userRef = db.collection('users').doc(userId);
        const userAuctionRef = userRef.collection('auctions').doc(previousDate);
        await userAuctionRef.get().then(auction => {
            if (!auction.exists) throw new Error('auction-r');
            else if (!auction.data().winner) throw new Error('auction-w');
        });

        // validate submitted profile
        const profile = Number(request.get('Profile'));
        if (!profile) throw new Error('profile-r');
        else if (!validateProfile(profile)) throw new Error('profile-v'); 

        // update current profile
        const profileRef = db.collection('profiles').doc(date);
        await profileRef.update({
            set: true,
            title: profile.title,
            imageLink: profile.imageLink,
            videoLink: profile.videoLink,
            text: profile.text,
            link1: { link: profile.link1.link, media: profile.link1.media, text: profile.link1.text },
            link2: { link: profile.link2.link, media: profile.link2.media, text: profile.link2.text },
            link3: { link: profile.link3.link, media: profile.link3.media, text: profile.link3.text }
        });
    }
    catch (err) {
        console.log('setProfile: ' + err);

        // choose error message
        var message = '';
        switch (err.message) {
            case 'auction-r': message = 'Error retrieving auction. Please wait and try again.'; break;
            case 'auction-w': message = 'You do not own the current profile.'; break;
            case 'profile-r': message = 'Error retrieving profile. Please wait and try again'; break;
            case 'profile-v': message = 'Error validating your profile data. Please change the input and re-submit.'; break;
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





/* AUCTION FUNCTIONS */

// (HTTP) post bid to current auction
exports.bidCurrentAuction = functions.https.onRequest(async (request, response) => {
    try {

        // handle preflight
        if (request.method == 'OPTIONS') {
            return cors(request, response, () => {
                response.send({ success: true });
            });
        }

        // enforce authentication
        var userId = undefined;
        const token = request.get('Authorization');
        await admin.auth().verifyIdToken(token)
            .then(
                decoded => { userId = decoded.user_id; }, 
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

                // save bid under auction
                const bidCount = auction.data().bidCount;
                const bidsRef = auctionRef.collection('bids').doc(String(bidCount));
                transaction.set(bidsRef, {
                    bid: bid,
                    user: userId
                });

                // save bid under user
                const userAuctionsRef = db.collection('users').doc(userId)
                    .collection('auctions').doc(date);
                transaction.set(userAuctionsRef, {
                    latestBid: bid,
                    winner: false
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

// (SCHEDULE) begin new auction
exports.startAuction = functions.pubsub.schedule('10 0 * * *')
    .timeZone('America/Los_Angeles').onRun(async context => {
        try {
            const date = getDateString();
            const target = getNextDateString();

            await db.collection('auctions').doc(date).set({
                date: date,
                target: target,
                current: true,
                bid: 0,
                bidCount: 0
            });
        }
        catch (err) { console.log('startAuction: ' + err); }
    }); 

// (SCHEDULE) end current auction
exports.endAuction = functions.pubsub.schedule('0 0 * * *')
    .timeZone('America/Los_Angeles').onRun(async context => {
        try {
            const date = getPreviousDateString();
            const auctionRef = db.collection('auctions').doc(date);

            // update auction status
            await auctionRef.update({ current: false })

            // update auction winner
            await auctionRef.get().then(async auction => {
                if (!auction.exists) throw new Error('Error retrieving auction');
                else {
                    if (auction.bidCount == 0) throw new Error('No auction bids');
                    const winningBid = String(auction.bidCount - 1);

                    // retrieve winning bid
                    const bidRef = auctionRef.collection('bids').doc(winningBid);
                    await bidRef.get().then(async bid => {
                        if (!bid.exists) throw new Error('Error retrieving bid');
                        else {

                            // update winning user permissions
                            const userAuctionRef = db.collection('users').doc(bid.user)
                                .collection('auctions').doc(date);
                            await userAuctionRef.update({ winner: true });
                        }
                    });
                }
            });
            
        }
        catch (err) { console.log('startAuction: ' + err); }
    });