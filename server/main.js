const fs = require('fs')

const { join } = require('path');

const cors = require('cors')
const bodyParser = require('body-parser')
const hbs = require('express-handlebars')
const mysql = require('mysql');
const express = require('express');

const config = require('./config/config.json')

const DB_HOST = process.env.DB_HOST || config.db_host || 'localhost'
const DB_PORT = parseInt(process.env.DB_PORT) || config.db_port || 3306
const DB_USER = process.env.DB_USER || config.db_user || 'fred'
const DB_PASSWORD = process.env.DB_PASSWORD || config.db_password || 'fred'

const PORT = parseInt(process.argv[2]) || config.app_port || parseInt(process.env.APP_PORT) || 3000

const mkQuery = function(sql, pool) {
	return function(params) {
		return (new Promise((resolve, reject) => {
			pool.getConnection((err, conn) => {
				if (err)
					return (reject(err));
				conn.query(sql, params || [],
					(err, result) => {
						conn.release()
						if (err)
							return (reject(err))
						resolve(result)
					})
			})
		}))
	}
}

const pool = mysql.createPool({
	host: DB_HOST, port: DB_PORT,
	user: DB_USER, password: DB_PASSWORD,
	database: 'northwind',
	connectionLimit: 4
});

let appReady = false;
let startTime = 0

let isAngular = false;
try {
	//Hack - check if this is an angular build
	fs.statSync(join(__dirname, '.angular'))
	isAngular = true;
} catch (err) { }


const listCustomers = mkQuery('select id, company from customers limit ? offset ?', pool)
const getCustomerById = mkQuery('select * from customers where id = ?', pool)

const app = express()

app.engine('hbs', hbs())
app.set('view engine', 'hbs')
app.set('views', join(__dirname, 'views'))

app.use(cors());
app.use(bodyParser.json());


app.get(['/api/customers', '/customers', '/'], (req, resp, next) => {

	//Hack - check if we should serve angular files
	if (isAngular && ('/' == req.path))
		return (next())

	const limit = parseInt(req.query.limit) || 10
	const offset = parseInt(req.query.offset) || 0
	listCustomers([limit, offset])
		.then(result => {
			resp.status(200)
			resp.format({
				'text/html': () => {
					resp.render('customers.hbs', { customer: result })
				},
				'application/json': () => {
					resp.json(result)
				},
				'default': () => {
					resp.status(415).end()
				}
			})
		})
		.catch(err => {
			resp.status(400).json({ error: err })
		})
})

app.get(['/api/customer/:id', '/customer/:id'], (req, resp) => {
	const custId = parseInt(req.params.id)
	getCustomerById([custId])
		.then(result => {
			if (!!result.length) {
				resp.status(200)
				resp.format({
					'text/html': () => {
						resp.render('customer.hbs', { customer: result[0] })
					},
					'application/json': () => {
						resp.json(result[0])
					},
					'default': () => {
						resp.status(415).end()
					}
				});
				return
			}
			resp.status(404)
			resp.format({
				'text/html': () => {
					resp.send('<h2>Not found</h2>')
				},
				'application/json': () => {
					resp.json({ error: 'Not found' })
				},
				'default': () => {
					resp.status(415).end()
				}
			})
		})
})

app.get('/config', (req, resp) => {
	resp.status(200).json({
		port: PORT,
		db_host: DB_HOST,
		db_port: DB_PORT,
		db_user: DB_USER
	})
})

app.get('/health', (req, resp) => {
	resp.status(200).json({ time: (new Date()).getTime() })
})

app.get('/ready', (req, resp) => {
	if (appReady)
		return (
			resp.status(200).json({ 
				status: appReady,
				uptime: Date.now() - startTime
			})
		);
	resp.status(400).json({});
})

app.use(express.static(join(__dirname, 'angular')))

app.use(express.static(join(__dirname, 'public')))

app.use((req, resp) => {
	resp.status(404).sendFile(join(__dirname, 'public', '404.html'));
})

app.listen(PORT, () => {
	startTime = Date.now()
	console.info('Application started on PORT %d at %s',
		PORT, (new Date()).toString());
})

pool.getConnection((err, conn) => {
	if (err)
		throw err;
	conn.ping((err) => {
		conn.release()
		if (err)
			throw err
		appReady = true;
	})
})
