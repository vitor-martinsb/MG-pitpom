"""Compatibility and cumulative evolution contracts for all eighty courses."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('campaign',ROOT/'build/generate-campaign.py')
campaign=importlib.util.module_from_spec(spec);spec.loader.exec_module(campaign)
class ReferenceCourses(unittest.TestCase):
    def test_exact_original_order_and_count(self):
        config=json.loads((ROOT/'data/config/game.cfg').read_text())
        self.assertEqual(config['num_levels'],80)
        self.assertEqual(config['family_campaign_version'],1)
        self.assertNotIn('campaign_version',config)
        self.assertEqual([config[f'level{i*4+1}'] for i in range(20)],[f'data/levels/level-{n}.level' for n in campaign.ORDER])
        self.assertEqual(len(list((ROOT/'data/levels').glob('*.level'))),20)
        self.assertEqual(len(list((ROOT/'data/campaign').glob('family-*.level'))),60)
    def test_original_geometry_hashes(self):
        baseline=json.loads((ROOT/'tests/fixtures/gameplay-before-garden.json').read_text())
        for n in range(1,21):
            name=f'data/levels/level-{n}.level'
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest(),baseline[name])
    def test_generated_catalogue_is_current(self):
        campaign.generate(check=True)
    def test_parent_chain_and_unique_geometry(self):
        rows=json.loads((ROOT/'data/campaign/manifest.json').read_text(encoding='utf-8'))['courses']
        self.assertEqual(len(rows),80)
        self.assertEqual(len({row['geometryHash'] for row in rows}),80)
        for family in range(20):
            chain=rows[family*4:family*4+4]
            for revision,row in enumerate(chain):
                self.assertEqual(row['family'],family+1)
                self.assertEqual(row['revision'],revision)
                self.assertEqual(row['parent'],chain[revision-1]['label'] if revision else None)
                self.assertEqual(row['baselineHash'],chain[0]['geometryHash'])
                if revision>1:self.assertEqual(row['operations'][:len(chain[revision-1]['operations'])],chain[revision-1]['operations'])
                level=json.loads((ROOT/row['path']).read_text())
                original=json.loads((ROOT/chain[0]['path']).read_text())
                # These are gameplay anchors, not a different synthetic start/goal.
                for kind in ['ball-start','hole']:
                    self.assertEqual(next(e for e in level['entities'] if e['type']==kind),next(e for e in original['entities'] if e['type']==kind))
    def test_new_streams_have_real_water_and_bank_geometry(self):
        rows=json.loads((ROOT/'data/campaign/manifest.json').read_text(encoding='utf-8'))['courses']
        water=[row for row in rows if row['hasNewWater']]
        self.assertEqual(len(water),21)
        for row in water:
            level=json.loads((ROOT/row['path']).read_text())
            streams=[e for e in level['entities'] if e['name'].startswith('evolution-stream-')]
            self.assertTrue(streams,row['label'])
            self.assertTrue(any(e['name']=='evolution-river-bank' for e in level['entities']))
            for e in streams:
                self.assertEqual(e['type'],'water')
                self.assertTrue(e['geo']['p'])
                for face in e['geo']['faces']:
                    # Campo 7's shader extrapolates white foam outside this
                    # range. Preserve this contract through every later bend.
                    self.assertEqual(face['uv_gen_type'],'manual')
                    self.assertEqual(len(face['uvs']),len(face['idxs'])*2)
                    self.assertTrue(all(0<=u<=1 for u in face['uvs'][::2]),row['label'])
                    self.assertGreater(max(face['uvs'][::2])-min(face['uvs'][::2]),0)
if __name__=='__main__':unittest.main()
