// SPDX-License-Identifier: LGPL-3.0-or-later
// Mount, then synchronously read part of the archive.
//
// `lazy: true` moves work out of the mount and into the reads, so mount time on its own says
// nothing about this workload — the whole mount-plus-read is what gets timed.
import { Zip } from '@zenfs/archives';
import { archive, type Archive } from './fixtures.ts';

interface Config {
	entries: number;
	size: number;
	spread?: number;
	/** Portion of the entries to read, from 0 to 1 */
	fraction: number;
	lazy: boolean;
}

interface State {
	fixture: Archive;
	data: Uint8Array;
	/** Every `stride`th entry is read, which samples the archive evenly instead of front-loading it */
	stride: number;
}

export function setup(config: Config): State {
	const fixture = archive({ entries: config.entries, size: config.size, spread: config.spread });
	return { fixture, data: new Uint8Array(0), stride: Math.max(1, Math.round(1 / config.fraction)) };
}

export function before(config: Config, state: State): void {
	state.data = new Uint8Array(state.fixture.zip);
}

export async function test(config: Config, state: State) {
	const fs = Zip.create({ data: state.data, lazy: config.lazy });
	await fs.ready();

	let bytes = 0,
		entries = 0;

	for (let i = 0; i < state.fixture.manifest.length; i += state.stride) {
		const [path, size] = state.fixture.manifest[i];
		fs.readSync(path, new Uint8Array(size), 0, size);
		bytes += size;
		entries++;
	}

	return { bytes, entries };
}
