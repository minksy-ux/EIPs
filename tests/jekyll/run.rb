#!/usr/bin/env ruby
# Run with: bundle exec ruby tests/jekyll/run.rb
require "jekyll"
require "minitest/autorun"
require "tmpdir"
require "fileutils"

class HeaderTest < Minitest::Test
  ROOT = File.expand_path("../..", __dir__)

  def setup
    @source = Dir.mktmpdir("jekyll-header-")
    FileUtils.cp_r(File.join(ROOT, "_includes"), @source)
    config = Jekyll.configuration(
      "source" => @source,
      "destination" => File.join(@source, "_site"),
      "plugins" => YAML.safe_load(File.read(File.join(ROOT, "_config.yml"))).fetch("plugins"),
      "baseurl" => "/preview",
      "title" => "EIPs & ERCs",
      "quiet" => true
    )
    @site = Jekyll::Site.new(config)
    @site.pages = [
      { "path" => "EIPS/eip-1.md", "title" => "EIP 1", "url" => "/EIPS/eip-1" },
      { "path" => "erc.html", "title" => "ERCs & standards", "url" => "/erc" },
      { "path" => "all.html", "title" => "All", "url" => "/all" },
      { "path" => "untitled.html", "url" => "/untitled" }
    ]
    @site.config["header_pages"] = ["all.html", "missing.html", "erc.html", "untitled.html"]
    start_render
  end

  def teardown
    FileUtils.remove_entry(@source)
  end

  def start_render
    Jekyll::Hooks.trigger(:site, :pre_render, @site, @site.site_payload)
  end

  def render(page = {})
    Liquid::Template.parse("{% include header.html %}").render!(
      { "site" => @site.site_payload["site"], "page" => page },
      :registers => { :site => @site }
    )
  end

  def links(html)
    html.scan(/<a class="page-link col" href="([^"]+)">([^<]+)<\/a>/)
  end

  def test_navigation_order_escaping_baseurl_and_missing_pages
    html = render("title" => "Not a navigation title")
    assert_includes html, 'href="/preview/">EIPs &amp; ERCs</a>'
    assert_equal [
      ["/preview/all", "All"],
      ["/preview/erc", "ERCs &amp; standards"]
    ], links(html)
  end

  def test_header_is_shared_between_eip_and_erc_pages
    eip = render("category" => "Core", "eip" => 1)
    erc = render("category" => "ERC", "eip" => 20)
    assert_equal eip, erc
    assert_match %r{_includes/header-cached\.html\s+\|\s+1\s+\|}, @site.liquid_renderer.stats_table
  end

  def test_fallback_navigation_when_header_pages_is_unset_or_empty
    [nil, []].each do |paths|
      @site.config["header_pages"] = paths
      start_render
      assert_equal [
        ["/preview/EIPS/eip-1", "EIP 1"],
        ["/preview/erc", "ERCs &amp; standards"],
        ["/preview/all", "All"]
      ], links(render)
    end
  end

  def test_rebuild_invalidates_titles_paths_and_baseurl
    render
    @site.config["header_pages"] = ["erc.html"]
    @site.config["baseurl"] = "/updated"
    @site.config["title"] = "Updated site"
    @site.pages[1]["title"] = "Updated ERCs"
    start_render
    html = render
    assert_includes html, 'href="/updated/">Updated site</a>'
    assert_equal [["/updated/erc", "Updated ERCs"]], links(html)
  end
end
