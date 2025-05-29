"use strict";
    // Import necessary modules
    const redis = require('redis'); // Redis client for Node.js (version 3.x)
    const { stringify } = require('csv-stringify'); // Library for converting data to CSV format
    const fs = require('fs'); // Node.js file system module for writing to a file
    const util = require('util'); // Node.js util module for promisify

    // --- Configuration ---
    // Redis connection details
    const REDIS_HOST = '127.0.0.1'; // Your Redis host
    const REDIS_PORT = 2468;       // Your Redis port
    const REDIS_PASSWORD = '';     // Your Redis password, if any. Leave empty if no password.
    const REDIS_DB = 0;            // The Redis database index to connect to (default is 0)

    // Output CSV file path
    const OUTPUT_CSV_FILE = 'redis_data.csv';

    // --- Main Script Logic ---

    async function convertRedisToCsv() {
        console.log('Connecting to Redis...');

        // Create a Redis client instance for redis@3.x
        // Note: For older Redis servers (like < 6.0), the 'auth' command takes only a password.
        // Also, very old servers (< 3.2) don't understand 'CLIENT SETNAME'.
        // redis@3.x handles these compatibility issues better.
        const client = redis.createClient(REDIS_PORT, REDIS_HOST);

        // Promisify Redis client commands for async/await usage
        // Note: Not all commands need to be promisified if you only use a few.
        // For 'redis@3.x', commands are typically `client.get()` (callback) or `client.getAsync()` (if using bluebird).
        // We'll promisify commonly used ones to keep async/await syntax.
        const promisifyCommands = [
            'scan', 'type', 'get', 'hgetall', 'lrange', 'smembers', 'zrange'
        ];

        promisifyCommands.forEach(cmd => {
            if (typeof client[cmd] === 'function') {
                client[cmd + 'Async'] = util.promisify(client[cmd]).bind(client);
            }
        });

        // Handle connection events
        client.on('connect', () => console.log('Redis client connected.'));
        client.on('error', (err) => console.error('Redis Client Error:', err));

        try {
            // Authenticate if a password is provided
            if (REDIS_PASSWORD) {
                // In redis@3.x, you call auth directly.
                // For Redis versions < 6.0, this command will only send the password.
                await util.promisify(client.auth).bind(client)(REDIS_PASSWORD);
                console.log('Authenticated with Redis.');
            }

            // Select the database
            await util.promisify(client.select).bind(client)(REDIS_DB);
            console.log(`Selected Redis DB ${REDIS_DB}.`);

            const csvRows = [];
            // Add CSV header row
            csvRows.push(['Key', 'Type', 'Value']);

            let cursor = '0'; // Initial cursor for SCAN command (string in redis@3.x)

            console.log('Scanning Redis keys and fetching data...');

            // Use SCAN command to iterate over keys, which is efficient for large databases
            do {
                // SCAN returns an array: [new_cursor, [key1, key2, ...]]
                const result = await client.scanAsync(cursor, 'COUNT', 100); // redis@3.x scan arguments
                cursor = result[0]; // Update cursor for the next iteration
                const keys = result[1];

                for (const key of keys) {
                    const type = await client.typeAsync(key); // Get the type of the key

                    let value;
                    // Fetch value based on key type
                    switch (type) {
                        case 'string':
                            value = await client.getAsync(key);
                            break;
                        case 'hash':
                            const hashData = await client.hgetallAsync(key);
                            value = JSON.stringify(hashData);
                            break;
                        case 'list':
                            const listData = await client.lrangeAsync(key, 0, -1);
                            value = JSON.stringify(listData);
                            break;
                        case 'set':
                            const setData = await client.smembersAsync(key);
                            value = JSON.stringify(setData);
                            break;
                        case 'zset':
                            // ZRANGE in redis@3.x uses different args and returns array of members, not objects
                            // You might need to adjust based on whether you want scores or not.
                            // For simplicity, let's get members without scores first.
                            const zsetData = await client.zrangeAsync(key, 0, -1);
                            value = JSON.stringify(zsetData);
                            // If you need scores, you might need to use ZRANGE <key> 0 -1 WITHSCORES
                            // and parse the result, which is more complex with promisify.
                            // For ZRANGE WITHSCORES in redis@3.x, it returns [member1, score1, member2, score2, ...]
                            // A custom promisified function might be needed for that.
                            break;
                        default:
                            value = `Unsupported Type: ${type}`;
                            break;
                    }
                    csvRows.push([key, type, value]); // Add the row to our CSV data array
                }
            } while (cursor !== '0'); // Continue scanning until cursor returns to '0' (string in redis@3.x)

            console.log(`Found and processed ${csvRows.length - 1} keys. Writing to CSV...`);

            // Convert the array of arrays to CSV string
            stringify(csvRows, { header: false }, (err, output) => {
                if (err) {
                    console.error('Error stringifying CSV:', err);
                    return;
                }
                // Write the CSV string to the output file
                fs.writeFile(OUTPUT_CSV_FILE, output, (writeErr) => {
                    if (writeErr) {
                        console.error('Error writing CSV file:', writeErr);
                    } else {
                        console.log(`Successfully converted Redis data to "${OUTPUT_CSV_FILE}"`);
                    }
                });
            });

        } catch (err) {
            console.error('An error occurred during Redis conversion:', err);
        } finally {
            // Ensure the Redis client is closed
            client.quit(); // client.quit() is a callback method in 3.x, doesn't return a promise
            console.log('Redis client disconnected.');
        }
    }

    // Execute the conversion function
    convertRedisToCsv();
/*
// Import necessary modules
const { stringify } = require('csv-stringify'); // Library for converting data to CSV format
const fs = require('fs'); // Node.js file system module for writing to a file
const redis = require('redis'); // Redis client for Node.js

// --- Configuration ---
// Redis connection details
const REDIS_HOST = '127.0.0.1'; // Your Redis host (e.g., 'localhost' or an IP address)
const REDIS_PORT = 2468;       // Your Redis port (default is 6379)
const REDIS_PASSWORD = 'Jr@Redis-CLI2021';     // Your Redis password, if any. Leave empty if no password.
const REDIS_DB = 0;            // The Redis database index to connect to (default is 0)

// Output CSV file path
const OUTPUT_CSV_FILE = 'redis_data.csv';

// --- Main Script Logic ---

async function convertRedisToCsv() {
    console.log('Connecting to Redis...');

    // Create a Redis client instance
    const client = redis.createClient({
        //url: `redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
        url: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
        // Add other options if needed, e.g., tls for SSL/TLS connections
    });

    // Handle connection events
    client.on('connect', () => console.log('Redis client connected.'));
    client.on('error', (err) => console.error('Redis Client Error:', err));

    try {
    

        const csvRows = [];
        // Add CSV header row
        csvRows.push(['Key', 'Type', 'Value']);

        let cursor = 0; // Initial cursor for SCAN command

        console.log('Scanning Redis keys and fetching data...');
        // Connect to Redis
        await client.connect();

        // Use SCAN command to iterate over keys, which is efficient for large databases
        do {
            // SCAN returns an array: [new_cursor, [key1, key2, ...]]
            const result = await client.scan(cursor, { COUNT: 100 }); // Fetch 100 keys at a time
            console.log('Result [line 50]: ' + result)
            cursor = parseInt(result.cursor); // Update cursor for the next iteration
            const keys = result.keys;
            console.log('Keys [line 52]: ' + keys)
            for (const key of keys) {
                const type = await client.type(key); // Get the type of the key
                console.log('Type [line 56]: ' + type)
                let value;
                // Fetch value based on key type                
                switch (type) {
                    case 'string':
                        value = await client.get(key);
                        console.log('Value [line 62]: ' + value)
                        break;
                    case 'hash':
                        // HMGET returns an array of values for specified fields.
                        // HGETALL returns all fields and values of a hash.
                        const hashData = await client.hGetAll(key);
                        // Convert hash object to a string representation for CSV
                        value = JSON.stringify(hashData);
                        console.log('Value [line 70]: ' + value)
                        break;
                    case 'list':
                        // LRANGE returns elements within a range from a list
                        const listData = await client.lRange(key, 0, -1);
                        value = JSON.stringify(listData);
                        console.log('Value [line 76]: ' + value)
                        break;
                    case 'set':
                        // SMEMBERS returns all members of the set
                        const setData = await client.sMembers(key);
                        value = JSON.stringify(setData);
                        console.log('Value [line 82]: ' + value)
                        break;
                    case 'zset':
                        // ZRANGE returns members of a sorted set in a range
                        // WITHSCORES option includes scores
                        const zsetData = await client.zRangeWithScores(key, 0, -1);
                        // Convert array of objects to a string representation
                        value = JSON.stringify(zsetData.map(item => ({ member: item.value, score: item.score })));
                        console.log('Value [line 90]: ' + value)
                        break;
                    default:
                        value = `Unsupported Type: ${type}`;
                        break;
                }
                csvRows.push([key, type, value]); // Add the row to our CSV data array
            }
        } while (cursor !== 0); // Continue scanning until cursor returns to 0

        console.log(`Found and processed ${csvRows.length - 1} keys. Writing to CSV...`);

        // Convert the array of arrays to CSV string
        stringify(csvRows, { header: false }, (err, output) => {
            if (err) {
                console.error('Error stringifying CSV:', err);
                return;
            }
            // Write the CSV string to the output file
            fs.writeFile(OUTPUT_CSV_FILE, output, (writeErr) => {
                if (writeErr) {
                    console.error('Error writing CSV file:', writeErr);
                } else {
                    console.log(`Successfully converted Redis data to "${OUTPUT_CSV_FILE}"`);
                }
            });
        });

    } catch (err) {
        console.error('An error occurred during Redis conversion:', err);
    } finally {
        // Ensure the Redis client is closed
        await client.quit();
        console.log('Redis client disconnected.');
    }
}

// Execute the conversion function
convertRedisToCsv();
*/
