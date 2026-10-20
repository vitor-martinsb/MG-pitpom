"""The structural guard must reject cosmetic copies, including turned copies."""
import copy
import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('campaign',ROOT/'build/generate-campaign.py')
campaign=importlib.util.module_from_spec(spec);spec.loader.exec_module(campaign)

class LayoutSimilarity(unittest.TestCase):
    def setUp(self):
        self.level,self.record=campaign.make_course(0,0)
        self.fingerprint=campaign.layouts.raster(self.level)

    def test_color_and_decoration_cannot_disguise_a_duplicate(self):
        level=copy.deepcopy(self.level)
        for material in level['materials']:material['color']=[1,0,1,1]
        level['entities'].append(campaign.entity('group','decoration',(200,0,200)))
        self.assertEqual(campaign.layouts.similarity(self.fingerprint,campaign.layouts.raster(level)),1)

    def test_rotation_reflection_and_translation_cannot_disguise_a_duplicate(self):
        for reflected in [False,True]:
            level=copy.deepcopy(self.level)
            for entity in level['entities']:
                if 'geo'not in entity:continue
                p=entity['geo']['p']
                for i in range(0,len(p),3):
                    x,z=p[i],p[i+2];p[i]=z+100;p[i+2]=(-x if reflected else x)-200
            self.assertEqual(campaign.layouts.similarity(self.fingerprint,campaign.layouts.raster(level)),1)

    def test_similar_candidates_are_actually_regenerated(self):
        attempts=[]
        def candidates(world,stage,attempt):
            attempts.append(attempt)
            return (copy.deepcopy(self.level),copy.deepcopy(self.record))if attempt<3 else campaign.make_course(world,stage,attempt)
        _,record,_,score=campaign.choose_course(0,1,[self.fingerprint],candidates)
        self.assertEqual(attempts[:4],[0,1,2,3]);self.assertGreaterEqual(record['designAttempt'],3);self.assertLess(score,.86)

if __name__=='__main__':unittest.main()
