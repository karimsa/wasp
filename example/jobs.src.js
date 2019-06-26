import { routine, forRange, useState } from '../core.macro'

const sum = routine(async target => {
	const s = await useState(0)
	await forRange(target, i => s.incrby(i))
	console.log(`Sum => ${await s.get()}`)
})

module.exports = {
	sum,
}
