import * as esbuild from 'esbuild';
import fs from 'fs';
import { createHash } from 'crypto';

esbuild.build({
    entryPoints: ['src/spider/video/cmshub.js'],
    outfile: 'dist/cmshub.js',
    bundle: true,
    minify: true,
    write: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    plugins: [genMd5()],
});

function genMd5() {
    return {
        name: 'gen-cmshub-md5',
        setup(build) {
            build.onEnd(async () => {
                const md5 = createHash('md5').update(fs.readFileSync('dist/cmshub.js')).digest('hex');
                fs.writeFileSync('dist/cmshub.js.md5', md5);
            });
        },
    };
}
