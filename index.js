/**
 * @file index.js
 * @copyright 2019-present Karim Alibhai. All rights reserved.
 */

const Redis = require('ioredis')
const Queue = require('bull')

const CTX_STOP = Symbol('$ctxStop')

function wrapCtx(id, ctx, redis, q) {
	const jobID = id
	const states = []
	const completed = (ctx.completed = ctx.completed || {})

	return {
		args: ctx.args,
		redis,
		async useState(id, value) {
			await redis.set(id, String(value), 'NX')
			states.push(id)
		},
		async forRange(id, num, fn) {
			if (typeof num !== 'number') {
				throw new Error(`Unknown target passed to forRange: '${num}'`)
			}

			if (ctx.state && ctx.state.id === id) {
				await fn(ctx.state.value)
				return CTX_STOP
			}

			if (!completed[id]) {
				const deps = []

				for (let i = 0; i < num; ++i) {
					deps.push(
						q.enqueue(jobID, {
							...ctx,
							state: {
								id,
								value: i,
							},
						}),
					)
				}

				await q.enqueue(
					jobID,
					{
						...ctx,
						state: {},
						completed: {
							...completed,
							[id]: true,
						},
					},
					{
						dependencies: await Promise.all(deps),
					},
				)

				return CTX_STOP
			}
		},
		destroy() {
			return Promise.all(
				states.map(id => {
					return redis.del(id)
				}),
			)
		},
	}
}

function routine(id, fn, opts = {}) {
	const qConfig = opts.queue || { name: 'default' }
	const q = new Queue(qConfig.name)
	const redis = new Redis(opts.redis)

	q.enqueue = (name, data, opts = {}) => {
		if (opts.dependencies) {
			return new Promise((resolve, reject) => {
				setTimeout(resolve, 5000)
			}).then(() => q.add({ name, data }))
		}
		return q.add({ name, data })
	}

	return Object.assign(
		async function(...args) {
			return q.enqueue(id, {
				args,
			})
		},
		{
			routineID: id,
			async $exec(data) {
				const ctx = wrapCtx(id, data, redis, q)
				const it = fn.apply(ctx, ctx.args)

				while (true) {
					const { value, done } = await it.next()
					if (done) {
						await ctx.destroy()
						break
					}
					if ((await value) === CTX_STOP) {
						break
					}
				}
			},
		},
	)
}

module.exports = {
	routine,
}
