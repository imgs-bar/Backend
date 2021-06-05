import CloudFlare


def main():
    cf = CloudFlare.CloudFlare(token='331a15e72579c5b673d861c652913bd358826', email='pringlepot123@gmail.com', raw=True)
    page_number = 0
    while True:
        page_number += 1
        raw_results = cf.zones.get(params={'per_page': 5, 'page': page_number})
        zones = raw_results['result']

        for zone in zones:
            zone_id = zone['id']
            zone_name = zone['name']
            print(zone_id, zone_name)

            if zone_name == 'imgs.bar':
                continue

            if zone_name.endswith('.ga'):
                continue
            if zone_name.endswith('.cf'):
                continue
            #dns_recs = cf.zones.dns_records.get(zone_id)
            #for rec in dns_recs['result']:
                #cf.zones.dns_records.delete(zone_id, rec['id'])
            page_rules = cf.zones.pagerules.get(zone_id)
            for rec in page_rules['result']:
                cf.zones.pagerules.delete(zone_id, rec['id'])
            #cf.zones.dns_records.post(zone_id, data={'name': '@', 'type': 'CNAME', 'content': 'i.imgs.bar', 'ttl': 1, 'proxied': True})
            #cf.zones.dns_records.post(zone_id, data={'name': '*', 'type': 'CNAME', 'content': zone_name, 'ttl': 1})
            # cf.zones.pagerules.post(zone_id, data={
            #     "status": 'active',
            #     "priority": 1,
            #     "actions": [
            #         {
            #             "id": 'forwarding_url',
            #             "value": {"url": 'https://i.imgs.bar/$2', "status_code": 302},
            #         },
            #     ],
            #     "targets": [
            #         {
            #             "target": 'url',
            #             "constraint": {"operator": 'matches', "value": "*" + zone_name + "/*"},
            # },
            # ],
            # })
        total_pages = raw_results['result_info']['total_pages']
        if page_number == total_pages:
            break


if __name__ == '__main__':
    main()
