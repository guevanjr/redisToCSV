"use strict";

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
    /*
    const client = redis.createClient({
        //url: `redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
        url: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
        // Add other options if needed, e.g., tls for SSL/TLS connections
    });*/
    const client = redis.createClient({
        host: '127.0.0.1',
        port: 2468/*,
        password: 'Jr@Redis-CLI2021'*/
    });


    // Handle connection events
    client.on('connect', () => console.log('Redis client connected.'));
    /*client.on('connect', function() {
        console.log('Redis connected ...')
    });
    */
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

