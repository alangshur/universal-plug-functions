
// get current date (e.g. 2-24-2020)
exports.getDateString = () => {

    // get PST date
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    var date = new Date(utc - 8 * 3600000);

    // return date string
    return (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getFullYear();
}