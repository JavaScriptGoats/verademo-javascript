const mysql = require('mysql');
const mariadb = require('mariadb')
const crypto = require('crypto');
const dbconnector = require('../utils/dbconnector.js');
const moment = require('moment')
const Blabber = require('../models/Blabber.js');
const fs = require('fs');
var nodemailer = require('nodemailer');
const path = require('path');
const image_dir = path.join(__dirname, '../../resources/images/');
const User = require('../utils/User.js');
const util = require('util');
const { resourceLimits } = require('worker_threads');
const { render } = require('swig');


async function showLogin(req, res) {
    try {
        let target = req.query.target;
        let username = req.query.username;
		
        if (req.session.username) {
			console.log("User is already logged in - redirecting...");
            if (target) {
                return res.redirect(target);
            } else {
                return res.redirect('feed');
            }
        }

        let user = await createFromRequest(req);
		if (user) {
            req.session.username = user.username;
			console.log("User is remembered - redirecting...");
			if (target) {
				return res.redirect(target);
			} else {
				// default to user's feed
				return res.redirect('feed');
			}
		} else {
			console.log("User is not remembered");
		}

		if (!username) {
			username = "";
		}

		if (!target) {
			target = "";
		}

		console.log("Entering showLogin with username " + username + " and target " + target);

		res.locals.target = target
		res.locals.username = username;

		return res.render('login');
    }
    catch (err) {
        console.error(err.message);
        return res.status(500).json(err);
    }
}

async function processLogin(req, res) {

	console.log("Entering processLogin");

    const username = req.body.user;
    const password = req.body.password;
    const remember = req.body.remember;
    const target = req.body.target;

    try {
        // Determine eventual redirect. Do this here in case we're already logged in
		let nextView;
		if (target) {
			nextView = 'res.redirect(target)';
		} else {
			// default to user's feed
			nextView = 'res.redirect("feed")';
		}

		// let connect = null;
		// let sqlStatement = null;
		try {
			// Get the Database Connection
			// console.log("Creating the Database connection");
			// connect = await mariadb.createConnection(dbconnector.getConnectionParams());
			// connect = mysql.createConnection(dbconnector.getConnectionParams());

			/* START BAD CODE */
			// Execute the query
			console.log("Creating the Statement");
			const sqlQuery = "select username, password, password_hint, created_at, last_login, \
			real_name, blab_name from users where username='" + username + "' \
			and password='" + crypto.createHash('md5').update(password).digest("hex") + "';"
			console.log("Execute the Statement");
			const result = await dbconnector.query(sqlQuery);
			/* END BAD CODE */
			/* START GOOD CODE */
			// const sqlQuery = "select * from users where username=? and password=?;";
			// console.log("Preparing the PreparedStatement");
			// sqlStatement = await connect.prepare(sqlQuery);
			// console.log("Executing the PreparedStatement");
			// const result = await sqlStatement.execute([username, password]);
			/* END GOOD CODE */

			// Did we find exactly 1 user that matched?
			if (result.length == 1) {
				let user = result[0];
				console.log("User Found.");
				// Remember the username as a courtesy.
				res.cookie('username', result.username);

				// If the user wants us to auto-login, store the user details as a cookie.
				if (remember != null) {
					let currentUser = new User.User(user["username"], user["password_hint"],
							user["created_at"], user["last_login"],
							user["real_name"], user["blab_name"]);

					await updateInResponse(currentUser, res);
				}

				req.session.username = user["username"];

				// Update last login timestamp
				// sqlStatement = await connect.prepare("UPDATE users SET last_login=NOW() WHERE username=?;");
				// await sqlStatement.execute([user['username']]);
				await dbconnector.query("UPDATE users SET last_login=NOW() WHERE username=?;", [user['username']])
			} else {
				// Login failed...
				console.log("User Not Found");
				res.locals.error = "Login failed. Please try again.";
				res.locals.target = target;
				nextView = "res.render('login')";
			}
		} catch (err) {
			console.error(err);
			res.locals.error = err;
			res.locals.target = target;
			nextView = "res.render('login')";
		} /* finally {
			try {
				if (sqlStatement) {
					sqlStatement.close();
				}
			} catch (err) {
				console.error(err);
				res.locals.error = err;
				res.locals.target = target
			}
			try {
				if (connect) {
					await promiseEnd();
				}
			} catch (err) {
				console.error(err);
				res.locals.error = err;
				res.locals.target = target
			}
		} */

		// Redirect to the appropriate place based on login actions above
		console.log("Redirecting to view: " + nextView);
		return eval(nextView);``
    }
    catch (err) {
        console.error(err.message);
        return res.status(500).json(err);
    }
}


async function showPasswordHint(req, res) {
	const username = req.query.username
	console.log("Entering password-hint with username: " + username);

	if (!username) {
		return res.json("No username provided, please type in your username first");
	}

	try {
		// let connect = await mariadb.createConnection(dbconnector.getConnectionParams());
		let sql = "SELECT password_hint FROM users WHERE username = '" + username + "'";
		console.log(sql);

		let result = await dbconnector.query(sql);
		if (result.length > 0) {
			let password = result[0]['password_hint'];
			let formatString = "Username '" + username + "' has password: %s%s";
			console.log(formatString);
			return res.json(util.format(formatString, password.slice(0, 2), '*'.repeat(password.length - 2)));
		} else {
			return res.json("No password found for " + username);
		}
	} catch (err) {
		console.error(err);
	} /* finally {
		try {
			if (connect) {
				await connect.close();
			}
		} catch (err) {
			console.error(err);
		}
	} */

	return res.json("ERROR!");
}

async function processLogout(req, res) {
	console.log("Entering processLogout");

	let type = req.query.type;

	req.session.username = null;

	let currentUser = null;
	await updateInResponse(currentUser, res);

	return res.redirect('login')
}

async function showRegister(req, res) {
	console.log("Entering showRegister");

    res.render('register');
}

async function processRegister(req, res)
{
	const username = req.body.user;
	res.locals.username = username;

	if (!username) {
		res.locals.error = "No username provided, please type in your username first"
        return res.render('register');
	}

	// console.log("Creating the Database connection");
	// let connect = null;
	try {
		// connect = await mariadb.createConnection(dbconnector.getConnectionParams());

		let sql = "SELECT username FROM users WHERE username = '" + username + "'";
		let result = await dbconnector.query(sql);
		if (result.length != 0) {
			res.locals.error = "Username '" + username + "' already exists!"
			return res.render('register');
		} else {
			return res.render('register-finish');
		}
	} catch (err) {
		console.error(err);
	} /* finally {
		try {
			if (connect) {
				await connect.close();
			}
		} catch (err) {
			console.error(err);
		}
	} */

    return res.render('register');
}

async function showRegisterFinish(req, res) {
	console.log("Entering showRegisterFinish");

	return res.render('register-finish')
}

async function processRegisterFinish(req, res) {
	console.log("Entering processRegisterFinish");

	const username = req.body.username;
	const password = req.body.password;
	const cpassword = req.body.cpassword;
	const realName = req.body.realName;
	const blabName = req.body.blabName;
	
	if (password !== cpassword) {
		console.log("Password and Confirm Password do not match");
		res.locals.error = "The Password and Confirm Password values do not match. Please try again.";
		return res.render('register')
	}

	// let connect;
	// let sqlStatement;

	try {
		// Get the Database Connection
		// console.log("Creating the Database connection");
		// connect = await mariadb.createConnection(dbconnector.getConnectionParams());

		// /* START EXAMPLE VULNERABILITY */
		// // Execute the query
		mysqlCurrentDateTime = moment().format("YYYY-MM-DD HH:mm:ss")

		let query = "insert into users (username, password, created_at, real_name, blab_name) values(";
		query += "'" + username + "',";
		query += "'" + crypto.createHash('md5').update(password).digest("hex") + "',";
		query += "'" + mysqlCurrentDateTime + "',";
		query += "'" + realName + "',";
		query += "'" + blabName + "'";
		query += ");";
		// START BAD CODE
		console.log(query);
		// END BAD CODE 
		/* START GOOD CODE
		if(headerTenantId) {headerTenantId = JSON.stringify(headerTenantId)
			+	}
			+	console.log(query);
		
		*///END GOOD CODE
		await dbconnector.query(query);
		req.session.username = username;
		
		// /* END EXAMPLE VULNERABILITY */

		//emailUser(username);
	} catch (err) {
		console.error(err);
	} /* finally {
		try {
			if (connect) {
				await connect.close();
			}
		} catch (err) {
			console.error(err);
		}
	} */

	return res.redirect("login?username=" + username);
}

function emailUser(username) {
	var transporter = nodemailer.createTransport({
		service: 'veracode',
		auth: {
			user:'verademo@veracode.com',
			pass: 'password'
		}
	});

	var message = {
		from: 'verademo@veracode.com',
		to: 'admin@example.com',
		subject: 'Account Registration',
		text: `A new VeraDemo user registered: ${username}`
	}
	console.log("Sending email to admin");
	transporter.sendMail(message, function(error, info){
		if (error) {
		  console.log(error);
		} else {
		  console.log('Email sent: ' + info.response);
		}
	  });
}

async function showProfile(req, res) {
	let type = req.query.type;
	console.log("Entering showProfile");
	let username = req.session.username;

	if (!username) {
		console.log("User is not Logged In - redirecting...");
		return res.redirect("login?target=profile");
	}

	// let connect = null;
	// let myHecklers = null;
	// let myInfo = null;
	let sqlMyHecklers = "SELECT users.username, users.blab_name, users.created_at "
				+ "FROM users LEFT JOIN listeners ON users.username = listeners.listener "
				+ "WHERE listeners.blabber=? AND listeners.status='Active';";

	try {
		// console.log("Getting Database connection");
		// connect = await mariadb.createConnection(dbconnector.getConnectionParams());
		
		console.log(sqlMyHecklers);
		// myHecklers = await connect.prepare(sqlMyHecklers);
		// let myHecklersResults = await myHecklers.execute([username]);
		let myHecklersResults = await dbconnector.query(sqlMyHecklers, [username])

		let hecklers = [];
		await myHecklersResults.forEach((heckler) => {
			let blabber = new Blabber();
			blabber.setUsername(heckler['username']);
			blabber.setBlabName(heckler['blab_name']);
			blabber.setCreatedDate(heckler['created_at']);
			blabber.getCreatedDateString();
			// START BAD CODE
			hecklers.push(blabber);
			// END BAD CODE
			/* START GOOD CODE
			hecklers.push(new Blabber(JSON.stringify(blabber));
            */// END GOOD CODE
		})
		
		let events = [];
		let sqlMyEvents = "select event from users_history where blabber=\"" + username
				+ "\" ORDER BY eventid DESC; ";
		console.log(sqlMyEvents);
		let userHistoryResult = await dbconnector.query(sqlMyEvents);

		await userHistoryResult.forEach((event) => {
			events.push(event['event']);
		})

		let sql = "SELECT username, real_name, blab_name FROM users WHERE username = '" + username + "'";
		console.log(sql);
		// myInfo = await connect.prepare(sql);
		// let myInfoResults = await myInfo.execute();
		let myInfoResults = await dbconnector.query(sql);

		res.locals.hecklers = hecklers;
		res.locals.events = events;
		res.locals.username = myInfoResults[0]['username'];
		res.locals.image = await getProfileImageFromUsername(myInfoResults[0]['username']);
		res.locals.realName = myInfoResults[0]['real_name'];
		res.locals.blabName = myInfoResults[0]['blab_name'];

	} catch (err) {
		console.error(err)
	} /* finally {
		try {
			if (myHecklers) {
				myHecklers.close();
			}
		} catch (err) {
			console.error(err);
		}
		try {
			if (connect) {
				await connect.close();
			}
		} catch (err) {
			console.error(err);
		}
	} */

	return res.render('profile');
}

async function processProfile(req, res) {
	console.log("Entering processProfile");

	const realName = req.body.realName;
	const blabName = req.body.blabName;
	const username = req.body.username;
	const file = req.files[0];

	let sessionUsername = req.session.username;
	if (!sessionUsername) {
		console.log("User is not Logged In - redirecting...");
		return res.redirect("login?target=profile");
	}

	console.log("User is Logged In - continuing... UA=" + req.get("user-agent") + " U=" + sessionUsername);

	let oldUsername = sessionUsername;
	// let connect = null;
	// let update = null;
	try {
		// console.log("Getting Database connection");
		// connect = await mariadb.createConnection(dbconnector.getConnectionParams());

		// console.log("Preparing the update Prepared Statement");
		// update = await connect.prepare("UPDATE users SET real_name=?, blab_name=? WHERE username=?;");
		
		console.log("Executing the update Prepared Statement");
		// let updateResult = await update.execute([realName, blabName, sessionUsername]);
		let updateResult = await dbconnector.query("UPDATE users SET real_name=?, blab_name=? WHERE username=?;", [realName, blabName, sessionUsername])
		
		if (updateResult.affectedRows != 1) {
			await res.set('content-type', 'application/json');
			return res.status(500).send("{\"message\": \"<script>alert('An error occurred, please try again.');</script>\"}");
		}
	} catch (err) {
		console.error(err);
	} /* finally {
		try {
			if (update) {
				update.close();
			}
		} catch (err) {
			console.log(err);
		}
		try {
			if (connect) {
				await connect.close();
			}
		} catch (err) {
			console.log(err);
		}
	} */

	// Rename profile image if username changes
	if (!(username == oldUsername)) {
		// Check if username exists
		let exists = false;
		let newUsername = username.toLowerCase();
		try {
			// console.log("Getting Database connection");
			// connect = await mariadb.createConnection(dbconnector.getConnectionParams());

			console.log("Preparing the duplicate username check Prepared Statement");
			// sqlStatement = await connect.prepare("SELECT username FROM users WHERE username=?");
			// let result = await sqlStatement.execute([newUsername]);
			let result = await dbconnector.query("SELECT username FROM users WHERE username=?", [newUsername])
			if (result.length != 0) {
				console.info("Username: " + username + " already exists. Try again.");
				exists = true;
			}
		} catch (err) {
			console.error(err);
		} /* finally {
			try {
				if (sqlStatement) {
					sqlStatement.close();
				}
			} catch (err) {
				console.error(err);
			}
			try {
				if (connect) {
					await connect.close();
				} 
			} catch (err) {
				console.error(err);	
			}
		} */
		if (exists) {
			await res.set('content-type', 'application/json');
			return res.status(409).send("{\"message\": \"<script>alert('That username already exists. Please try another.');</script>\"}");
		}

		// Attempt to update username
		oldUsername = oldUsername.toLowerCase();
		let sqlUpdateQueries = [];
		let renamed = false;
		try {
			// console.log("Getting Database connection");
			// connect = await mariadb.createConnection(dbconnector.getConnectionParams());
			let connect = await dbconnector.getConnection();
			const pBeginTransaction = util.promisify(connect.beginTransaction).bind(connect);
			const pQuery = util.promisify(connect.query).bind(connect);
			const pCommit = util.promisify(connect.commit).bind(connect);
			const pRollback = util.promisify(connect.rollback).bind(connect);
			const pRelease = util.promisify(connect.release).bind(connect);

			let sqlStrQueries = ["UPDATE users SET username=? WHERE username=?",
								"UPDATE blabs SET blabber=? WHERE blabber=?",
								"UPDATE comments SET blabber=? WHERE blabber=?",
								"UPDATE listeners SET blabber=? WHERE blabber=?",
								"UPDATE listeners SET listener=? WHERE listener=?",
								"UPDATE users_history SET blabber=? WHERE blabber=?"];
			
			try {
				await pBeginTransaction();
				try {
					for (query of sqlStrQueries) {
						console.log("Preparing the Prepared Statement: " + query)
						// sqlUpdateQueries.push(await connect.prepare(query));
						await pQuery(query, [newUsername, oldUsername])
					}

					// for (statement of sqlUpdateQueries) {
					// 	await statement.execute([newUsername, oldUsername]);
					// }

					await pCommit();
					pRelease();
				} catch (err) {
					console.error("Error loading data, reverting changes: ", err);
					await pRollback();
					pRelease();
				}
			} catch (err) {
				console.error("Error starting a transaction: ", err);
				await pRollback();
				pRelease();
			}

			oldImage = await getProfileImageFromUsername(oldUsername);
			if (oldImage) {
				extension = oldImage.substring(oldImage.lastIndexOf("."));

				console.log ("Renaming profile image from " + oldImage + " to " + newUsername + extension);
				oldName = image_dir + oldImage;
				newName = image_dir + newUsername + extension;

				fs.rename(oldName, newName, (err) => { if (err) throw err; });
			}
			renamed = true;
		} catch (err) {
			console.error(err);
		} /* finally {
			try {
				if (sqlUpdateQueries) {
					for (statement of sqlUpdateQueries) {
						statement.close();
					}
				}
			} catch (err) {
				console.error(err);
			}
			try {
				if (connect) {
					await connect.close();
				}
			} catch (err) {
				console.error(err);
			}
		} */
		if (!renamed) {
			await res.set('content-type', 'application/json');
			return res.status(500).send("{\"message\": \"<script>alert('An error occurred, please try again.');</script>\"}");
		}

		// Update all session and cookie logic
		req.session.username = username;
		res.cookie('username', username);

		// Update remember me functionality
		let currentUser = await createFromRequest(req);
		if (currentUser) {
			currentUser.username = username;
			await updateInResponse(currentUser, res);
		}
	}

	// Update user profile image
	if (file) {
		let oldImage = await getProfileImageFromUsername(username);
		if (oldImage) {
			fs.unlink(image_dir + oldImage, (err) => { if (err) throw err; });
		}

		try {
			let extension = await file.filename.substring(file.filename.lastIndexOf("."));
			let filepath = image_dir + username + extension;

			console.log("Saving new profile image: " + filepath);

			fs.rename(file.path, filepath, (err) => { if (err) throw err; })
		} catch (err) {
			console.error(err);
		}

	}

	let msg = `Successfully changed values!\\\\nusername: ${username.toLowerCase()}\\\\nReal Name: ${realName}\\\\nBlab Name: ${blabName}`;
	let response = `{\"values\": {\"username\": \"${username.toLowerCase()}\", \"realName\": \"${realName}\", \"blabName\": \"${blabName}\"}, \"message\": \"<script>alert('`
			+ msg + `');</script>\"}`;

	await res.set('content-type', 'application/json');
	return res.status(200).send(response);

}

async function downloadImage(req, res) {
	const imageName = req.query.image;
	console.log("Entering downloadImage");

    // Ensure user is logged in
	username = req.session.username;
    if (username == null) {
        console.log("User is not Logged In - redirecting...");
        return res.redirect("login?target=feed");
    }
    console.log("User is Logged In - continuing... UA=" + req.headers["User-Agent"] + " U=" + username);

	let filepath = image_dir + imageName;
	console.log("Fetching profile image: " + filepath);

	await res.download(filepath);
	return res.render('profile');
}

async function createFromRequest(req) {
	const cookie = req.cookies.user;
    if (!cookie) {
        return null;
    }
    const user = JSON.parse(atob(cookie));
    return user;
}

async function updateInResponse(currentUser, res) {
    res.cookie('user', btoa(JSON.stringify(currentUser)));
    return res;
}

async function getProfileImageFromUsername(username) {
	let files = fs.readdirSync(image_dir);
	for (const filename of files) {
		if (filename.startsWith(username + '.')) {
			return filename;
		}
	}
	return null;
}

module.exports = { 	
	showLogin,
	processLogin,
	processLogout,
	showRegister, 
	processRegister, 
	showRegisterFinish, 
	processRegisterFinish,
	showProfile,
	processProfile,
	downloadImage,
	showPasswordHint,
};

