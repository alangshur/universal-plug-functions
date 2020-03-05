
// get current date (e.g. 2-24-2020)
exports.getDateString = () => {

    // get PST date
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var date = new Date(utc - 8 * 3600000);

    // return date string
    return (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getFullYear();
}

// get next date string (e.g. 2-25-2020)
exports.getNextDateString = () => {
    
    // get PST date
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var date = new Date(utc + 16 * 3600000);

    // return date string
    return (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getFullYear();
}

// get next date string (e.g. 2-23-2020)
exports.getPreviousDateString = () => {
    
    // get PST date
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var date = new Date(utc - 32 * 3600000);

    // return date string
    return (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getFullYear();
}

// valid a candidate profile
exports.validateProfile = () => {

    // verify that each field exists and is valid
    return true;
}