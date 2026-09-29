import { config as loadDotenv } from "dotenv";
import { parseArgs } from "node:util";

loadDotenv({ quiet: true });

/**
 * Runtime environment the app is running in.
 * - `development`: local development.
 * - `test`: automated test runs.
 * - `production`: deployed builds.
 */
type NodeEnv = "development" | "test" | "production";

/** Settings read from the process environment (and `.env`, when present). */
interface EnvConfig {
	/** Runtime environment, from `NODE_ENV`. Defaults to `development`. */
	nodeEnv: NodeEnv;
	/** Display name for the app, from `APP_NAME`. Defaults to `node-starter`. */
	appName: string;
}

/** Options parsed from the command line. */
interface CliOptions {
	/** Show usage and exit. */
	help: boolean;
	/** Print extra diagnostic output. */
	verbose: boolean;
	/** Name to greet. */
	name: string;
	/** Positional arguments left after flags are parsed. */
	args: string[];
}

const NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];

const USAGE = `Usage: node build/server.js [options] [args...]

Options:
  -n, --name <name>  Name to greet (default: "world")
  -v, --verbose      Print extra diagnostic output
  -h, --help         Show this help and exit`;

/**
 * Reads an environment variable, falling back to a default when it is unset or empty.
 * @param key - Environment variable name.
 * @param fallback - Value used when the variable is missing.
 * @returns The variable's value, or `fallback`.
 */
function readEnv(key: string, fallback: string): string {
	const value = process.env[key];
	return value === undefined || value === "" ? fallback : value;
}

/**
 * Narrows a string to a {@link NodeEnv}.
 * @param value - Raw `NODE_ENV` value.
 * @returns The value as a `NodeEnv`.
 * @throws {Error} When the value is not a known environment.
 */
function parseNodeEnv(value: string): NodeEnv {
	const match = NODE_ENVS.find((env) => env === value);
	if (!match) {
		throw new Error(`Invalid NODE_ENV "${value}"; expected one of: ${NODE_ENVS.join(", ")}`);
	}
	return match;
}

/**
 * Builds the typed env config from `process.env`.
 * @returns The validated env config.
 * @throws {Error} When a variable holds an invalid value.
 */
function loadEnvConfig(): EnvConfig {
	return {
		nodeEnv: parseNodeEnv(readEnv("NODE_ENV", "development")),
		appName: readEnv("APP_NAME", "node-starter"),
	};
}

/**
 * Parses CLI arguments into typed options.
 * @param argv - Arguments after the node binary and script path.
 * @returns The parsed CLI options.
 * @throws {TypeError} When an unknown flag or a malformed value is passed.
 */
function parseCliOptions(argv: string[]): CliOptions {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			help: { type: "boolean", short: "h", default: false },
			verbose: { type: "boolean", short: "v", default: false },
			name: { type: "string", short: "n", default: "world" },
		},
	});

	return {
		help: values.help,
		verbose: values.verbose,
		name: values.name,
		args: positionals,
	};
}

/**
 * Entry point: loads config, parses CLI arguments, and runs the app.
 * @param argv - Arguments after the node binary and script path.
 * @returns The process exit code.
 */
function main(argv: string[]): number {
	const env = loadEnvConfig();
	const options = parseCliOptions(argv);

	if (options.help) {
		console.log(USAGE);
		return 0;
	}

	if (options.verbose) {
		console.log(`[${env.appName}] env=${env.nodeEnv} args=${JSON.stringify(options.args)}`);
	}

	console.log(`Hello, ${options.name}!`);
	return 0;
}

try {
	process.exitCode = main(process.argv.slice(2));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	console.error(`\n${USAGE}`);
	process.exitCode = 1;
}
