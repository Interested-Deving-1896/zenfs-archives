// SPDX-License-Identifier: LGPL-3.0-or-later
// Entry-heavy, byte-light archives: the per-entry cost of mounting, isolated from reading.
import { Zip } from '@zenfs/archives';
import { archive, type Archive } from './fixtures.ts';

interface Config {
	entries: number;
	size: number;
	lazy: boolean;
}

interface State {
	fixture: Archive;
	/** A fresh copy per iteration, since a mount may retain or transform the buffer it was given */
	data: Uint8Array;
}

export function setup(config: Config): State {
	const fixture = archive({ entries: config.entries, size: config.size, depth: 2 });
	return { fixture, data: new Uint8Array(0) };
}

export function before(config: Config, state: State): void {
	state.data = new Uint8Array(state.fixture.zip);
}

export async function test(config: Config, state: State) {
	const fs = Zip.create({ data: state.data, lazy: config.lazy });
	await fs.ready();
	return { entries: state.fixture.manifest.length };
}
