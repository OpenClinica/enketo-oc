const auth = require('basic-auth');
const express = require('express');
const account = require('../models/account-model');

const router = express.Router();
// const debug = require( 'debug' )( 'account-controller' );

module.exports = (app) => {
    app.use('/accounts/api/v1', router);
};

router
    .all('*', (req, res, next) => {
        // set content-type to json to provide appropriate json Error responses
        res.set('Content-Type', 'application/json');
        next();
    })
    .all('*', authCheck)
    .get('/account', getExistingAccount)
    .post('/account', getNewOrExistingAccount)
    .put('/account', updateExistingAccount)
    .delete('/account', removeAccount)
    .get('/list', getList)
    .post('/list', getList)
    .all('*', (req, res, next) => {
        const error = new Error('Not allowed');
        error.status = 405;
        next(error);
    });

function authCheck(req, res, next) {
    // check authentication and account
    let error;

    const creds = auth(req);
    const key = creds ? creds.name : undefined;

    if (!key || key !== req.app.get('account manager api key')) {
        error = new Error('Not Allowed. Invalid API key.');
        error.status = 401;
        res.status(error.status).set(
            'WWW-Authenticate',
            'Basic realm="Enter valid API key as user name"'
        );
        next(error);
    } else {
        next();
    }
}

function getExistingAccount(req, res, next) {
    return account
        .get({
            linkedServer: req.query.server_url,
            key: req.query.api_key,
        })
        .then((account) => {
            _render(200, account, res);
        })
        .catch(next);
}

function getNewOrExistingAccount(req, res, next) {
    return account
        .set({
            linkedServer: req.body.server_url || req.query.server_url,
            key: req.body.api_key || req.query.api_key,
        })
        .then((account) => {
            _render(account.status || 201, account, res);
        })
        .catch(next);
}

function updateExistingAccount(req, res, next) {
    return account
        .update({
            linkedServer: req.body.server_url || req.query.server_url,
            key: req.body.api_key || req.query.api_key,
        })
        .then((account) => {
            _render(account.status || 201, account, res);
        })
        .catch(next);
}

function removeAccount(req, res, next) {
    return account
        .remove({
            linkedServer: req.body.server_url || req.query.server_url,
            key: req.body.api_key || req.query.api_key,
        })
        .then(() => {
            _render(204, null, res);
        })
        .catch(next);
}

function getList(req, res, next) {
    return account
        .getList()
        .then((list) => {
            _render(200, list, res);
        })
        .catch(next);
}

function _render(status, body, res) {
    if (status === 204) {
        // send 204 response without a body
        res.status(status).end();
    } else {
        body = body || {};
        if (typeof body === 'string') {
            body = {
                message: body,
            };
        } else if (Array.isArray(body)) {
            body = body.map((account) => _renameProps(account));
        } else if (typeof body === 'object') {
            body = _renameProps(body);
        }
        body.code = status;
        res.status(status).json(body);
    }
}

function _renameProps(account) {
    return {
        server_url: account.linkedServer,
        api_key: account.key,
    };
}
