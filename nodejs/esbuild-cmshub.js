import * as esbuild from 'esbuild';
import fs from 'fs';
import { createHash } from 'crypto';

esbuild.build({
    entryPoints: ['src/spider/video/cmshub.js'],
    outfile: 'dist/cmshub.cjs',
    bundle: true,
    minify: true,
    write: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    legalComments: 'none',
    plugins: [genMd5()],
});

function genMd5() {
    return {
        name: 'gen-cmshub-iife-md5',
        setup(build) {
            build.onEnd(async () => {
                const md5 = createHash('md5').update(fs.readFileSync('dist/cmshub.cjs')).digest('hex');
                fs.writeFileSync('dist/cmshub.cjs.md5', md5);
            });
        },
    };
}
