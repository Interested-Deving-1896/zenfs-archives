// SPDX-License-Identifier: LGPL-3.0-or-later
import { zipSync } from 'fflate';

/** Deterministic PRNG, so a fixture is byte-identical across runs, machines, and git references. */
export function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

const types = ['int', 'str', 'bytes', 'float', 'bool', 'object', 'Any', 'None'];

/** Python-stub-like text of roughly `bytes`, which compresses about as well as the real thing. */
function stub(random: () => number, bytes: number): Uint8Array {
	let out = 'import sys\nfrom typing import Any, overload\n\n';
	for (let i = 0; out.length < bytes; i++) {
		const a = types[(random() * types.length) | 0];
		const b = types[(random() * types.length) | 0];
		out += random() < 0.25 ? `class C${i}:\n    def m${i}(self, x: ${a}) -> ${b}: ...\n` : `def f${i}(x: ${a}, y: ${b} = ...) -> ${a}: ...\n`;
	}
	return new TextEncoder().encode(out);
}

export interface ArchiveOptions {
	entries: number;
	/** Bytes per entry, or the mean when `spread` is set */
	size: number;
	/** Spread sizes along a long tail around `size`, the way a real archive's files are distributed */
	spread?: number;
	/** Maximum directory depth. 1 puts everything in one directory. */
	depth?: number;
}

export interface Archive {
	zip: Uint8Array;
	/** Absolute path and uncompressed size of every entry, so a timed read never has to walk the tree */
	manifest: [path: string, size: number][];
	/** Total uncompressed bytes */
	bytes: number;
}

/**
 * Build a zip in memory. Nothing touches the disk, so a fixture cannot go stale against the code
 * that reads it, and a git reference's worktree needs no fixture directory of its own.
 */
export function archive({ entries, size, spread = 0, depth = 4 }: ArchiveOptions): Archive {
	const random = rng(entries * 31 + size);
	const files: Record<string, Uint8Array> = {};
	const groups = ['stdlib', 'stubs'];

	for (let i = 0; i < entries; i++) {
		const parts = [groups[i % groups.length]];
		for (let d = 1; d < 1 + ((random() * depth) | 0); d++) parts.push(`pkg${(random() * 12) | 0}_${d}`);
		parts.push(`module_${i}.pyi`);

		// Long tail: most files small, a few very large, mean near `size`
		const bytes = spread ? Math.round(size * 0.075 + Math.pow(random(), 5) * size * 5.5) : size;
		files[parts.join('/')] = stub(random, bytes);
	}

	const zip = zipSync(files, { level: 6 });
	const manifest = Object.entries(files).map(([path, data]): [string, number] => ['/' + path, data.byteLength]);

	return { zip, manifest, bytes: manifest.reduce((sum, [, n]) => sum + n, 0) };
}
