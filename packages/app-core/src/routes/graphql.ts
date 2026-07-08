import {
	graphql,
	GraphQLBoolean,
	GraphQLID,
	GraphQLNonNull,
	GraphQLObjectType,
	GraphQLScalarType,
	GraphQLSchema,
	GraphQLString,
	Kind,
	type ExecutionResult,
	type ValueNode,
} from 'graphql';
import type {
	ActorEvent,
	ActorRegistry,
	CapabilityProvider,
} from '../ports/capability-provider.js';
import { getHealth } from '../use-cases/health.js';

interface GraphqlRequest {
	readonly query?: unknown;
	readonly variables?: Record<string, unknown>;
	readonly operationName?: string;
}

const jsonScalar = new GraphQLScalarType({
	name: 'JSON',
	description: 'Arbitrary JSON value passed through without transformation.',
	serialize: (value) => value,
	parseValue: (value) => value,
	parseLiteral: parseJsonLiteral,
});

const healthType = new GraphQLObjectType({
	name: 'Health',
	fields: {
		ok: { type: new GraphQLNonNull(GraphQLBoolean) },
		appName: { type: new GraphQLNonNull(GraphQLString) },
		runtime: { type: new GraphQLNonNull(GraphQLString) },
	},
});

const actorSnapshotType = new GraphQLObjectType({
	name: 'ActorSnapshot',
	fields: {
		value: { type: jsonScalar },
		context: { type: jsonScalar },
	},
});

const schema = new GraphQLSchema({
	query: new GraphQLObjectType<unknown, CapabilityProvider>({
		name: 'Query',
		fields: {
			health: {
				type: new GraphQLNonNull(healthType),
				resolve: (_source, _args, provider) => getHealth(provider),
			},
			actorSnapshot: {
				type: new GraphQLNonNull(actorSnapshotType),
				args: { id: { type: new GraphQLNonNull(GraphQLID) } },
				resolve: (_source, args, provider) =>
					getActors(provider).get(String(args.id)).getSnapshot(),
			},
		},
	}),
	mutation: new GraphQLObjectType<unknown, CapabilityProvider>({
		name: 'Mutation',
		fields: {
			sendActorEvent: {
				type: new GraphQLNonNull(actorSnapshotType),
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
					event: { type: new GraphQLNonNull(jsonScalar) },
				},
				resolve: (_source, args, provider) =>
					getActors(provider)
						.get(String(args.id))
						.send(toActorEvent(args.event)),
			},
		},
	}),
});

export async function handleGraphql(
	request: Request,
	provider: CapabilityProvider,
): Promise<Response> {
	if (request.method !== 'POST') {
		return Response.json(
			{ errors: [{ message: 'Method not allowed' }] },
			{ status: 405 },
		);
	}

	let body: GraphqlRequest;
	try {
		body = (await request.json()) as GraphqlRequest;
	} catch {
		return Response.json(
			{ errors: [{ message: 'Invalid JSON body' }] },
			{ status: 400 },
		);
	}

	if (typeof body.query !== 'string') {
		return Response.json(
			{ errors: [{ message: 'Missing GraphQL query' }] },
			{ status: 400 },
		);
	}

	const result = await graphql({
		schema,
		source: body.query,
		variableValues: body.variables,
		operationName: body.operationName,
		contextValue: provider,
	});

	return Response.json(serializeResult(result));
}

function getActors(provider: CapabilityProvider): ActorRegistry {
	if (!provider.actors) {
		throw new Error('Actor capability is not enabled');
	}
	return provider.actors;
}

function toActorEvent(value: unknown): ActorEvent {
	if (
		!value ||
		typeof value !== 'object' ||
		typeof (value as { type?: unknown }).type !== 'string'
	) {
		throw new Error('Invalid actor event');
	}
	return value as ActorEvent;
}

function serializeResult(result: ExecutionResult): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	if (result.data !== undefined) {
		payload.data = result.data;
	}
	if (result.errors && result.errors.length > 0) {
		payload.errors = result.errors.map((error) => ({
			message: error.message,
			...(error.path ? { path: error.path } : {}),
		}));
	}
	return payload;
}

function parseJsonLiteral(ast: ValueNode): unknown {
	switch (ast.kind) {
		case Kind.STRING:
		case Kind.BOOLEAN:
		case Kind.ENUM:
			return ast.value;
		case Kind.INT:
			return Number.parseInt(ast.value, 10);
		case Kind.FLOAT:
			return Number.parseFloat(ast.value);
		case Kind.NULL:
			return null;
		case Kind.LIST:
			return ast.values.map(parseJsonLiteral);
		case Kind.OBJECT: {
			const object: Record<string, unknown> = {};
			for (const field of ast.fields) {
				object[field.name.value] = parseJsonLiteral(field.value);
			}
			return object;
		}
		default:
			return undefined;
	}
}
