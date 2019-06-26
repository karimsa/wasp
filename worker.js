/**
 * @file worker.js
 * @copyright 2019-present Karim Alibhai. All rights reserved.
 */

const Queue = require('bull')
const path = require('path')
const q = new Queue('default')

const jobs = (function(jobFns) {
	const jobs = {}
	for (const name of Object.keys(jobFns)) {
		jobs[jobFns[name].routineID] = jobFns[name].$exec
	}
	return jobs
})(require(path.resolve(process.cwd(), process.argv[2], 'jobs.js')))

q.process((job, done) => {
	const { name, data } = job.data
	// console.log(`Got: ${name} / %O`, data)

	const fn = jobs[name]
	if (!fn) {
		console.error(`! No such job: ${name}`)
		throw new Error(`Unknown job: ${name}`)
	}

	console.time(`${name}:${job.id}`)
	fn(data)
		.then(() => {
			console.timeEnd(`${name}:${job.id}`)
			done()
		})
		.catch(err => done(err))
})
