var express = require('express');
var fs = require('fs');
var request = require('request');
var rp = require('request-promise');
var cheerio = require('cheerio');
var app = express();
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/mpf');

var _fundSchema = {
    code: Number,
    name: String,
    provider: String,
    category: String
};
_fundSchema['1Month'] = String;
_fundSchema['3Month'] = String;
_fundSchema['6Month'] = String;
_fundSchema['YTD'] = String;
_fundSchema['1Year'] = String;
_fundSchema['FundExpenseRatio'] = String;
_fundSchema['RiskIndicator'] = String;
_fundSchema['RiskLevel'] = Number;

var fundSchema = mongoose.Schema(_fundSchema);
var Fund = mongoose.model('Fund', fundSchema);

app.get('/', function (req, res) {

    const url = 'http://www.aastocks.com/en/mpf/search.aspx?tab=2&s=14&o=0&sp=&t=7';
    const category = 'Money Market';
    let data;

    request(url, function (error, response, html) {


        if (!error) {
            var $ = cheerio.load(html);

            data = '<ul>';
            $('.tblM.s2.mpfDL2 .col2>a').filter(function() {
                let title = $(this).text().split(' - ');
                let provider = title[0];
                let name = title[1];
                let code = $(this).attr('href').replace('javascript:gotoComp(', '').replace(')', '');

                let aFund = {
                    code: code,
                    name: name,
                    provider: provider,
                    category: category
                };

                Fund.findOneAndUpdate({ code: code }, aFund, { upsert: true }, function(err, fund) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('saved', fund);
                    }
                });
            });
            data += '</ul>';

            res.send(data);
        }
    });

});

app.get('/updateFund/:code', function (req, res) {

    const code = req.params.code;
    const url = `http://www.aastocks.com/en/mpf/compare.aspx?comp1=${code}`;

    console.log(url);
    request(url, function (error, response, html) {

        let data = {}, saveData = {};

        if (!error) {
            let $ = cheerio.load(html);
            const fields = ['1-Month', '3-Month', '6-Month', 'YTD', '1-Year', 'Fund Expense Ratio', 'Risk Indicator']
            fields.forEach((ele) => {
                data[ele] = $('td:contains("' + ele + '")').first().next().text();
            });

            data['Risk Level'] = $('td:contains("Risk Level")').first().next().find('img').attr('style').match(/\d+/g)[0];
        }

        Object.keys(data).forEach(ele => {
            saveData[ele.replace(' ','').replace('-','')] = data[ele];
        })

        console.log(saveData);

        Fund.findOneAndUpdate({ code: code }, saveData, { upsert: true }, function (err, fund) {
            if (err) {
                res.send('fail');
            } else {
                res.send(JSON.stringify(data));
            }
        });

    });

});


app.get('/batchUpdate/:count', function (req, res) {

    let count = parseInt(req.params.count, 10);

    Fund.find({'1Month': {$exists: false}}).limit(count).then(res => {
        console.log(res);
        res.map((fund) => {
            return rp('http://localhost:8081/updateFund/' + fund.code).then((res) => {
                console.log(res);
            })
        });
    });

});

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('DB connected');
    app.listen('8081');
});


console.log('Magic happens on port 8081');

exports = module.exports = app;