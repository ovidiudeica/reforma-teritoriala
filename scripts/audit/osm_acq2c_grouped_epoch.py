"""Bound memory by reconciling contiguous typed histories individually.

The semantic validator is the existing tested epoch core, without exceptions or
weakened continuity checks. No file/network I/O or source admission occurs here.
"""
import itertools
from osm_acq2c_selected_epoch_core import reconcile, tail_record, moment

def replay_groups(base_rows, tail_rows, requested, base_epoch, target_epoch, emit):
    if moment(base_epoch)>=moment(target_epoch):raise ValueError('Invalid epochs')
    tails={}
    for raw in tail_rows:
        code=tail_record(raw)['code']
        if code not in requested:raise ValueError('Unrequested tail identity')
        tails.setdefault(code,[]).append(raw)
    processed=set();selected={};gaps=[];duplicates=post=versions=0
    def consume(code, rows):
        nonlocal duplicates,post,versions
        if code not in requested or code in processed:raise ValueError('Unrequested/noncontiguous history group')
        processed.add(code)
        result=reconcile(rows,tails.pop(code,[]),{code},base_epoch,target_epoch)
        selected.update(result['selected']);gaps.extend(result['gapped_ids'])
        duplicates+=result['duplicate_observations_deduplicated'];post+=result['post_target_versions_retained']
        for history in result['histories'].values():
            for row in history:emit(row);versions+=1
    for code,rows in itertools.groupby(base_rows,key=lambda r:r['code']):consume(code,rows)
    for code in sorted(set(tails)):consume(code,[])
    return dict(selected=selected,missing_ids=sorted(set(requested)-selected.keys()),gapped_ids=sorted(gaps),duplicate_observations_deduplicated=duplicates,post_target_versions_retained=post,versions=versions,source_qualified=False,dependency_closure_certified=False,unknown_adjudicated=0)
