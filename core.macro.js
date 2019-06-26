/**
 * @file src/core.macro.js
 * @copyright 2019-present Karim Alibhai. All rights reserved.
 */

const { v4: uuid } = require('uuid')
const { createMacro } = require('babel-plugin-macros')
const {
	memberExpression,
	callExpression,
	thisExpression,
	identifier,
	numericLiteral,
	stringLiteral,
	yieldExpression,
	assertMemberExpression,
	assertCallExpression,
} = require('@babel/types')

module.exports = createMacro(({ references }) => {
	for (const path of references.useState) {
		if (!path.parentPath.isCallExpression()) {
			throw new Error(`useState() can only be called as a function`)
		}

		const id = stringLiteral(uuid())
		path.parent.arguments.unshift(id)
		path.replaceWith(memberExpression(thisExpression(), identifier('useState')))

		const varDecl = path.findParent(p => p.isVariableDeclarator())
		for (const childPath of varDecl.scope.getBinding(varDecl.node.id.name)
			.referencePaths) {
			assertMemberExpression(childPath.parent)
			assertCallExpression(childPath.parentPath.parent)

			const args = childPath.parentPath.parent.arguments
			const call = callExpression(
				memberExpression(
					memberExpression(thisExpression(), identifier('redis')),
					childPath.parent.property,
				),
				[id, ...args],
			)
			childPath.parentPath.parentPath.replaceWith(call)
		}
	}

	for (const path of references.forRange) {
		const awaitExp = path.findParent(p => p.isAwaitExpression())
		awaitExp.replaceWith(yieldExpression(awaitExp.node.argument))
		path.replaceWith(memberExpression(thisExpression(), identifier('forRange')))
		path.parent.arguments.unshift(stringLiteral(uuid()))
	}

	for (const path of references.routine) {
		if (path.parent.arguments[0].type.startsWith('Arrow')) {
			path.parent.arguments[0].type = 'FunctionExpression'
		}

		const fn = path.parent.arguments[0]
		path.parent.arguments.unshift(stringLiteral(uuid()))
		path.replaceWithSourceString(`require('../').routine`)

		fn.async = true
		fn.generator = true
	}
})
