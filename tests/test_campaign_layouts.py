"""Reference restoration must preserve the catalog and immutable level hashes."""
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
        self.assertEqual(config['num_levels'],20)
        self.assertNotIn('campaign_version',config)
        self.assertEqual([config[f'level{i+1}'] for i in range(20)],[f'data/levels/level-{n}.level' for n in campaign.ORDER])
        self.assertEqual(len(list((ROOT/'data/levels').glob('*.level'))),20)
        self.assertEqual(list((ROOT/'data/campaign').glob('*.level')),[])
    def test_original_geometry_hashes(self):
        baseline=json.loads((ROOT/'tests/fixtures/gameplay-before-garden.json').read_text())
        for n in range(1,21):
            name=f'data/levels/level-{n}.level'
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest(),baseline[name])
    def test_generated_catalogue_is_current(self):
        campaign.generate(check=True)
if __name__=='__main__':unittest.main()
