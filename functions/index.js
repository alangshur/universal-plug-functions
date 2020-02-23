const functions = require('firebase-functions');
var cors = require('cors')({ origin: true });

exports.helloWorld = functions.https.onRequest((request, response) => {
    cors(request, response, () => {
        response.send({ test: 'Hello, world!' });
    });
});
